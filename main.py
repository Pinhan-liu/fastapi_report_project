# main.py —— AI-NetTune 后端：4个接口（第2周版：已接入唐苗仿真数据集）
# 数据源：data/network_data.csv（12960条，11列，含 network_status）
#   - 接口1/接口2：已从 mock 切换为 CSV 真实查询 + 多KPI规则研判
#   - 接口3：规则版意图识别（第3周换大模型API）
#   - 接口4：报告生成占位（第3周接入真实生成）
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import datetime
import csv as _csv
import statistics
from pathlib import Path

app = FastAPI()

# 允许前端(React dev server 5173)跨域调用本后端
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://10.63.118.174:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ 数据源：唐苗仿真数据集（12960条） ============
# 注意：表头首列带 BOM（\ufefftimestamp），必须用 utf-8-sig 读取
DATA_PATH = Path(__file__).resolve().parent / "data" / "network_data.csv"

def load_data():
    if not DATA_PATH.exists():
        print("[WARN] 未找到 data/network_data.csv，接口将返回空数据")
        return []
    with open(DATA_PATH, encoding="utf-8-sig", newline="") as f:
        return list(_csv.DictReader(f))

DF = load_data()

ALL_COLUMNS = ["timestamp", "ap_id", "user_id", "rsrp", "sinr", "throughput",
               "latency", "packet_loss", "prb_usage", "scenario", "network_status"]


def filter_rows(scenario, start_time, end_time, ap_id=None, user_id=None):
    """按场景/时间/AP/用户过滤 CSV 数据，按时间升序返回"""
    rows = []
    for r in DF:
        if r["scenario"] != scenario:
            continue
        if ap_id and r["ap_id"] != ap_id:
            continue
        if user_id and r["user_id"] != user_id:
            continue
        if not (start_time <= r["timestamp"] <= end_time):
            continue
        rows.append(r)
    rows.sort(key=lambda x: x["timestamp"])
    return rows


def avg(rows, key):
    try:
        return statistics.mean(float(r[key]) for r in rows)
    except Exception:
        return 0.0


# ============ 接口1：查询监测数据 ============
@app.get("/api/data/query")
def data_query(
    scenario: str = Query(..., description="场景，如：校园"),
    start_time: str = Query("2026-01-01 00:00:00", description="开始时间"),
    end_time: str = Query("2026-01-02 23:59:59", description="结束时间"),
    ap_id: str | None = Query(None, description="AP编号，不传查全部"),
    user_id: str | None = Query(None, description="用户编号，不传查全部"),
    metrics: str | None = Query(None, description="要返回的KPI列，逗号分隔，如 rsrp,sinr；不传返回全部"),
    limit: int = Query(100, ge=1, le=1000, description="最多返回条数"),
):
    # 从唐苗CSV按条件过滤，返回真实数据
    rows = filter_rows(scenario, start_time, end_time, ap_id, user_id)[:limit]
    columns = ALL_COLUMNS
    if metrics:
        wanted = [m.strip() for m in metrics.split(",")]
        columns = ["timestamp"] + wanted
    records = [{k: r[k] for k in columns} for r in rows]

    return {
        "code": 0,
        "message": "success",
        "data": {
            "total": len(records),
            "columns": columns,
            "records": records,
        },
    }


# ============ 接口2：多KPI联合故障研判 ============
class AnomalyRequest(BaseModel):
    scenario: str
    window_start: str
    window_end: str
    metrics: list[str] = ["rsrp", "sinr", "throughput"]


def judge_ap(ap, ap_rows):
    """对单个AP做多KPI联合研判（通信规则 + 状态标签占比），返回研判结果dict"""
    rsrp_avg = avg(ap_rows, "rsrp")
    sinr_avg = avg(ap_rows, "sinr")
    thr_avg = avg(ap_rows, "throughput")
    prb_avg = avg(ap_rows, "prb_usage")
    pkt_avg = avg(ap_rows, "packet_loss")

    # 该AP窗口内的状态标签占比（唐苗数据已标注）
    st = {}
    for r in ap_rows:
        st[r["network_status"]] = st.get(r["network_status"], 0) + 1
    weak_ratio = st.get("weak_coverage", 0) / len(ap_rows)
    cong_ratio = st.get("congestion", 0) / len(ap_rows)

    # 逐KPI对照通信阈值，构建证据链
    evidence = []
    if rsrp_avg < -105:
        evidence.append({"metric": "rsrp", "avg_value": round(rsrp_avg, 2), "threshold": -105, "status": "异常"})
    if sinr_avg < 5:
        evidence.append({"metric": "sinr", "avg_value": round(sinr_avg, 2), "threshold": 5, "status": "异常"})
    if prb_avg > 90:
        evidence.append({"metric": "prb_usage", "avg_value": round(prb_avg, 2), "threshold": 90, "status": "异常"})
    if pkt_avg > 5:
        evidence.append({"metric": "packet_loss", "avg_value": round(pkt_avg, 2), "threshold": 5, "status": "异常"})

    base = {
        "ap_id": ap,
        "rsrp_avg": round(rsrp_avg, 1), "sinr_avg": round(sinr_avg, 1),
        "thr_avg": round(thr_avg, 1), "prb_avg": round(prb_avg, 1),
        "weak_ratio": round(weak_ratio, 3), "cong_ratio": round(cong_ratio, 3),
        "evidence": evidence,
    }

    # 规则优先级：覆盖故障 > 网络拥塞 > 边缘弱用户
    if weak_ratio > 0.3 or (rsrp_avg < -105 and sinr_avg < 5):
        level = "严重" if weak_ratio > 0.5 else "中等"
        return {**base, "anomaly_type": "覆盖故障", "level": level, "network_status": "weak_coverage",
                "cause": f"{ap}弱覆盖采样占比{weak_ratio*100:.0f}%、RSRP均值{rsrp_avg:.1f}dBm，判定为覆盖空洞",
                "suggestion": "建议检查AP天线倾角/功率或增加补盲AP"}
    if cong_ratio > 0.25 or prb_avg > 90:
        level = "严重" if cong_ratio > 0.5 else "中等"
        return {**base, "anomaly_type": "网络拥塞", "level": level, "network_status": "congestion",
                "cause": f"{ap}拥塞采样占比{cong_ratio*100:.0f}%、PRB利用率均值{prb_avg:.1f}%，判定为容量拥塞",
                "suggestion": "建议负载均衡或扩容"}
    if thr_avg < 50:
        return {**base, "anomaly_type": "边缘弱用户", "level": "中等", "network_status": "weak_coverage",
                "cause": f"{ap}吞吐量均值{thr_avg:.1f}Mbps偏低、SINR均值{sinr_avg:.1f}dB，判定为边缘弱用户",
                "suggestion": "建议用户靠近信号源或调整波束"}

    return {**base, "anomaly_type": "正常", "level": "低", "network_status": "normal",
            "cause": f"{ap}各项指标均在正常范围", "suggestion": "无需处理"}


@app.post("/api/analyze/anomaly")
def analyze_anomaly(req: AnomalyRequest):
    # 第2周深化版：CSV真实数据，按AP分组多KPI联合研判（可解释证据链）
    # 新增：hourly_trend 小时趋势 / ap_comparison 多AP对比 / alarm_history 告警历史
    rows = filter_rows(req.scenario, req.window_start, req.window_end)
    if not rows:
        return {"code": 0, "message": "success",
                "data": {"is_anomaly": False, "reason": "该时间窗口无数据",
                         "hourly_trend": [], "ap_comparison": [], "alarm_history": []}}

    sev_rank = {"严重": 0, "中等": 1, "低": 9}

    # 1) 按 AP 分组研判 → 主结果
    by_ap = {}
    for r in rows:
        by_ap.setdefault(r["ap_id"], []).append(r)
    ap_results = [judge_ap(ap, ap_rows) for ap, ap_rows in sorted(by_ap.items())]
    findings = [res for res in ap_results if res["anomaly_type"] != "正常"]

    if findings:
        findings.sort(key=lambda f: sev_rank.get(f["level"], 9))
        m = findings[0]
        is_anomaly, anomaly_type, level = True, m["anomaly_type"], m["level"]
        evidence, cause, suggestion = m["evidence"], m["cause"], m["suggestion"]
        nstatus, affected_aps = m["network_status"], [f["ap_id"] for f in findings]
        confidence = round(min(0.99, 0.6 + 0.08 * len(evidence) + (0.1 if len(findings) > 1 else 0)), 2)
    else:
        rsrp_avg = avg(rows, "rsrp"); sinr_avg = avg(rows, "sinr")
        thr_avg = avg(rows, "throughput"); prb_avg = avg(rows, "prb_usage")
        is_anomaly, anomaly_type, level = False, "正常", "低"
        evidence = []
        cause = (f"各AP的RSRP均值{rsrp_avg:.1f}dBm、SINR均值{sinr_avg:.1f}dB、PRB利用率{prb_avg:.1f}%、"
                 f"吞吐量均值{thr_avg:.1f}Mbps，各项指标均在正常范围")
        suggestion, nstatus, affected_aps = "无需处理", "normal", []
        confidence = 0.95

    # 2) 按小时切片 → 趋势（回答"什么时候开始变差的"）
    by_hour = {}
    for r in rows:
        by_hour.setdefault(r["timestamp"][:13], []).append(r)  # "2026-01-01 10"

    hourly_trend = []
    for hour in sorted(by_hour):
        hour_by_ap = {}
        for r in by_hour[hour]:
            hour_by_ap.setdefault(r["ap_id"], []).append(r)
        hour_res = [judge_ap(ap, ap_rows) for ap, ap_rows in hour_by_ap.items()]
        hour_findings = [x for x in hour_res if x["anomaly_type"] != "正常"]
        if hour_findings:
            hour_findings.sort(key=lambda f: sev_rank.get(f["level"], 9))
            top = hour_findings[0]
        else:
            top = hour_res[0]
        hourly_trend.append({
            "hour": hour,
            "anomaly_type": top["anomaly_type"], "level": top["level"],
            "network_status": top["network_status"],
            "rsrp_avg": top["rsrp_avg"], "sinr_avg": top["sinr_avg"],
            "thr_avg": top["thr_avg"], "prb_avg": top["prb_avg"],
        })

    # 3) 多 AP 横向对比（哪台AP最差）
    ap_comparison = [
        {k: res[k] for k in ("ap_id", "rsrp_avg", "sinr_avg", "thr_avg", "prb_avg",
                             "weak_ratio", "cong_ratio", "anomaly_type", "level")}
        for res in ap_results
    ]

    # 4) 告警历史：小时×AP 命中异常（按时间倒序）
    alarm_history = []
    for hour in sorted(by_hour, reverse=True):
        hour_by_ap = {}
        for r in by_hour[hour]:
            hour_by_ap.setdefault(r["ap_id"], []).append(r)
        for ap, ap_rows in hour_by_ap.items():
            res = judge_ap(ap, ap_rows)
            if res["anomaly_type"] != "正常":
                alarm_history.append({
                    "time": hour, "ap_id": ap,
                    "anomaly_type": res["anomaly_type"], "level": res["level"],
                    "cause": res["cause"],
                })
    alarm_history = alarm_history[:50]

    return {
        "code": 0,
        "message": "success",
        "data": {
            "is_anomaly": is_anomaly,
            "anomaly_type": anomaly_type,
            "level": level,
            "confidence": confidence,
            "kpi_evidence": evidence,
            "cause": cause,
            "suggestion": suggestion,
            "affected_aps": affected_aps,
            "network_status": nstatus,
            "hourly_trend": hourly_trend,        # 新增：小时级趋势
            "ap_comparison": ap_comparison,      # 新增：多AP横向对比
            "alarm_history": alarm_history,      # 新增：告警历史
        },
    }


# ============ 接口3：自然语言对话 ============
class ChatRequest(BaseModel):
    message: str
    session_id: str = "sess_001"
    scenario: str = "校园"


@app.post("/api/agent/chat")
def agent_chat(req: ChatRequest):
    # 第2周：规则版意图识别（演示"意图驱动"雏形；第3周换成大模型API）
    # 数据窗口默认取 CSV 第一天（2026-01-01）
    win_start, win_end = "2026-01-01 00:00:00", "2026-01-01 23:59:59"

    # 命中异常关键词 → 判为异常查询意图，返回真实研判结论 + 真实折线数据
    anomaly_keywords = ["异常", "问题", "故障", "卡", "不好", "差", "掉线", "信号弱", "网络"]
    if any(k in req.message for k in anomaly_keywords):
        an = analyze_anomaly(AnomalyRequest(scenario=req.scenario,
                                            window_start=win_start, window_end=win_end))
        d = an["data"]
        rows = filter_rows(req.scenario, win_start, win_end)[:60]
        times = [r["timestamp"][11:16] for r in rows]
        rsrp_series = [round(float(r["rsrp"]), 1) for r in rows]

        if d.get("is_anomaly"):
            reply = f"检测到{d['anomaly_type']}（{d['level']}）：{d['cause']}。建议：{d['suggestion']}。"
        else:
            reply = f"当前时段未发现明显异常：{d['cause']}。"

        return {
            "code": 0,
            "message": "success",
            "data": {
                "reply": reply,
                "intent": "anomaly_query",
                "chart": {
                    "type": "line",
                    "option": {
                        "xAxis": {"data": times},
                        "series": [{"name": "RSRP(dBm)", "data": rsrp_series}],
                    },
                },
                "query_ref": {"scenario": req.scenario,
                              "start_time": win_start, "end_time": win_end},
            },
        }

    # 默认：普通数据查询意图 → 返回真实均值概况
    rows = filter_rows(req.scenario, win_start, win_end)
    if rows:
        reply = (f"当前时段网络整体运行平稳：RSRP均值{avg(rows,'rsrp'):.1f}dBm，"
                 f"SINR均值{avg(rows,'sinr'):.1f}dB，平均吞吐量{avg(rows,'throughput'):.1f}Mbps，"
                 f"PRB利用率{avg(rows,'prb_usage'):.1f}%，共{len(rows)}条采样。")
    else:
        reply = f"未找到场景「{req.scenario}」在所选时段的数据。"

    return {
        "code": 0,
        "message": "success",
        "data": {
            "reply": reply,
            "intent": "general_query",
            "chart": None,
            "query_ref": {"scenario": req.scenario},
        },
    }


# ============ 接口4：导出分析报告 ============
class ReportRequest(BaseModel):
    scenario: str
    start_time: str
    end_time: str
    format: str = "md"
    include_chart: bool = True


@app.post("/api/export/report")
def export_report(req: ReportRequest):
    # 第一周：只生成报告编号与下载路径；第3周接入真实报告生成
    report_id = "RPT_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    ext = "md" if req.format in ("md", "markdown") else "html"
    return {
        "code": 0,
        "message": "success",
        "data": {
            "report_id": report_id,
            "file_url": f"/download/reports/{report_id}.{ext}",
        },
    }
