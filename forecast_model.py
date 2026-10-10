# forecast_model.py —— 区域信号/频谱态势预测（P1 任务1：程思源）
# 职责：1小时聚合 → Prophet 时序预测（含置信区间）→ 契约兼容输出
# 设计：
#   - 输入：filter_rows 过滤后的原始行（与 main.py 同一数据源）
#   - 聚合：UE × 指标 × 1 小时桶（rsrp/sinr/throughput 均值）
#   - 训练/测试：前 80% 训练 Prophet，后 20% 测试 → true/predicted/MAPE
#   - 未来预测：测试段后再延伸 forecast_horizon 小时，输出 yhat/lower/upper
#   - 容错：序列过短或 Prophet 失败 → 自动降级 moving_average，保证接口永不崩
# 答辩口径：预测模块统一表述为"区域信号/频谱态势预测"，页面标注"未来预测"
import logging
from datetime import datetime

import numpy as np
import pandas as pd

logger = logging.getLogger("forecast_model")
logger.setLevel(logging.ERROR)

DEFAULT_METRICS = ["rsrp", "sinr", "throughput"]
TRAIN_RATIO = 0.8          # 前 80% 训练
FORECAST_HORIZON = 24      # 未来延伸 24 小时（1 天）

# Prophet 拟合失败时禁止输出优化日志刷屏
# 【Windows 修复】prophet 依赖 cmdstanpy，其 Windows 路径会执行 where.exe tbb.dll 探测；
# 在 detached/沙箱启动的进程（如 uvicorn -WindowStyle Hidden）里该探测输出解码异常导致
# CmdStanPyBackend 加载失败（Prophet object has no attribute 'stan_backend'）。
# 对策：导入 prophet 前先把自带 TBB 目录预置进 PATH，让探测直接命中、不走异常分支。
try:
    import importlib.resources

    _local_cmdstan = importlib.resources.files("prophet") / "stan_model" / "cmdstan-2.37.0"
    _tbb = _local_cmdstan / "stan" / "lib" / "stan_math" / "lib" / "tbb"
    if _tbb.is_dir():
        import os as _os
        _os.environ["PATH"] = str(_tbb) + _os.pathsep + _os.environ.get("PATH", "")
except Exception:
    pass

try:
    from prophet import Prophet
    _HAS_PROPHET = True
except Exception:
    _HAS_PROPHET = False


def _hour_bin(ts: str) -> str | None:
    """时间戳 → 1 小时桶（"2026-01-01 01:00"），解析失败返回 None"""
    try:
        dt = datetime.strptime(ts, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None
    return dt.replace(minute=0, second=0).strftime("%Y-%m-%d %H:%M")


def aggregate_hourly(rows: list[dict], metrics: list[str]) -> dict:
    """rows → {ue: {metric: (bins[], vals[])}}，按 1 小时桶聚合均值，时间升序"""
    buckets = {}
    for r in rows:
        k = _hour_bin(r["timestamp"])
        if k is None:
            continue
        ue = r["user_id"]
        for m in metrics:
            try:
                v = float(r[m])
            except (KeyError, TypeError, ValueError):
                continue
            b = buckets.setdefault(ue, {}).setdefault(m, {})
            b.setdefault(k, []).append(v)
    out = {}
    for ue, by_metric in buckets.items():
        out[ue] = {}
        for m, grouped in by_metric.items():
            items = sorted(grouped.items())
            out[ue][m] = ([k for k, _ in items], [round(sum(vs) / len(vs), 2) for _, vs in items])
    return out


def _ma_fallback(vals: list[float], horizon: int) -> dict:
    """降级：移动平均(win=3) 预测测试段均值 + 未来恒定预测，返回契约结构"""
    n = len(vals)
    if n < 4:
        return None
    split = max(2, int(n * TRAIN_RATIO))
    train, test = vals[:split], vals[split:]
    ma = train[-3:] if len(train) >= 3 else train
    pred_c = sum(ma) / len(ma)
    true_c = sum(test) / len(test)
    mape = abs(true_c - pred_c) / max(abs(true_c), 1e-6) * 100
    return {
        "method": "moving_average",
        "true_mean": round(true_c, 2),
        "pred_mean": round(pred_c, 2),
        "mape": round(min(mape, 999.0), 2),
        "forecast": [round(pred_c, 2)] * horizon,
        "lower": [round(pred_c, 2)] * horizon,
        "upper": [round(pred_c, 2)] * horizon,
    }


def prophet_series(bins: list[str], vals: list[float], horizon: int) -> dict:
    """单个 UE × 指标序列的 Prophet 预测。
    返回 {true_mean, pred_mean, mape, predicted(测试段), forecast, lower, upper} 或 None"""
    n = len(vals)
    if n < 24:  # 至少 24 个点（1 天）才训练
        return _ma_fallback(vals, horizon)

    split = max(int(n * TRAIN_RATIO), n - horizon)
    train_df = pd.DataFrame({"ds": pd.to_datetime(bins[:split]), "y": vals[:split]})
    test_df = pd.DataFrame({"ds": pd.to_datetime(bins[split:]), "y": vals[split:]})

    if not _HAS_PROPHET or len(train_df) < 12:
        return _ma_fallback(vals, horizon)

    try:
        m = Prophet(
            seasonality_mode="additive",
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=False,   # 30 天数据无年周期
        )
        m.fit(train_df)
        pred = m.predict(test_df)
        # 未来延伸：从最后一个训练点起 +horizon 小时
        future = m.make_future_dataframe(periods=len(test_df) + horizon, freq="h")
        ffull = m.predict(future)
        f_future = ffull.iloc[-(horizon):]

        y_true = np.array(vals[split:])
        y_pred = pred["yhat"].to_numpy()
        true_mean = float(np.mean(y_true))
        pred_mean = float(np.mean(y_pred))
        denom = max(abs(true_mean), 1e-6)
        mape = abs(true_mean - pred_mean) / denom * 100

        return {
            "method": "prophet",
            "true_mean": round(true_mean, 2),
            "pred_mean": round(pred_mean, 2),
            "mape": round(min(mape, 999.0), 2),
            "predicted": [round(float(v), 2) for v in y_pred],
            "forecast": [round(float(v), 2) for v in f_future["yhat"]],
            "lower": [round(float(v), 2) for v in f_future["yhat_lower"]],
            "upper": [round(float(v), 2) for v in f_future["yhat_upper"]],
        }
    except Exception as e:
        import traceback
        logger.error("prophet fit failed: %s\n%s", e, traceback.format_exc())
        return _ma_fallback(vals, horizon)


def build_series(rows: list[dict], metrics: list[str] | None = None,
                 horizon: int = FORECAST_HORIZON) -> dict:
    """总入口：rows → 契约兼容的 series 结构。
    返回 {ues, metrics, bin_size_min, series:{ue:{m:{...}}}}"""
    metrics = metrics or DEFAULT_METRICS
    agg = aggregate_hourly(rows, metrics)
    ues = sorted(agg.keys())
    series = {}
    for ue, by_metric in agg.items():
        series[ue] = {}
        for m, (bins, vals) in by_metric.items():
            r = prophet_series(bins, vals, horizon)
            if r is None:
                series[ue][m] = {"method": "none", "true_mean": None, "pred_mean": None, "mape": None,
                                 "bins": [], "true": [], "predicted": [],
                                 "forecast_bins": [], "forecast": [], "lower": [], "upper": []}
                continue
            # bins/true 全量输出（前端对比图用）；predicted 仅测试段
            series[ue][m] = {
                **r,
                "bins": bins,
                "true": vals,
                "forecast_bins": make_future_bins(bins[-1], horizon),
            }
    return {"ues": ues, "metrics": metrics, "bin_size_min": 60, "series": series}


def make_future_bins(last_bin: str, horizon: int) -> list[str]:
    """未来桶时间标签（供 forecast_bins 使用）"""
    dt = pd.to_datetime(last_bin)
    return [(dt + pd.Timedelta(hours=h + 1)).strftime("%Y-%m-%d %H:%M") for h in range(horizon)]
