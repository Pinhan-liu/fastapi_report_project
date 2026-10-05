# main.py —— AI-NetTune 后端：4个接口（第2周版：已接入唐苗仿真数据集 v2.3）
# 数据源：data/network_data.csv（12960条，18列，含坐标/network_status/3个辅助字段）
#   - 接口1/接口2：已从 mock 切换为 CSV 真实查询 + 多KPI规则研判
#   - 接口3：LLM 意图解析 + 工具编排
#   - 接口4：报告生成占位（第3周接入真实生成）
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import datetime
import csv as _csv
import statistics
from pathlib import Path
import llm_agent
from llm_agent import get_intent

app = FastAPI()
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# 全局参数校验异常处理：统一返回格式
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content={
            "code": 40001,
            "message": "参数校验失败",
            "data": None
        }
    )

# ========== 新增：全局服务端异常兜底 ==========
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "code": 50000,
            "message": "服务内部错误",
            "data": None
        }
    )
# 允许前端(React dev server 5173)跨域调用本后端
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://10.63.118.174:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ 数据源：唐苗仿真数据集（12960条，18列） ============
# 注意：表头首列带 BOM（\ufefftimestamp），必须用 utf-8-sig 读取
DATA_PATH = Path(__file__).resolve().parent / "data" / "network_data.csv"

def load_data():
    if not DATA_PATH.exists():
        print("[WARN] 未找到 data/network_data.csv，接口将返回空数据")
        return []
    with open(DATA_PATH, encoding="utf-8-sig", newline="") as f:
        return list(_csv.DictReader(f))

DF = load_data()

# 完整 18 列：11 核心 KPI + AP/UE 坐标（4列）+ 故障深度分析辅助字段（3列）
ALL_COLUMNS = ["timestamp", "ap_id", "ap_x", "ap_y", "user_id", "ue_x", "ue_y",
               "rsrp", "sinr", "throughput", "latency", "packet_loss", "prb_usage",
               "scenario", "network_status",
               "retransmission_count", "traffic_demand", "active_users"]

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
        end_time: str = Query("2026-01-03 23:59:59", description="结束时间"),
        ap_id: str | None = Query(None, description="AP编号，不传查全部"),
        user_id: str | None = Query(None, description="用户编号，不传查全部"),
        metrics: str | None = Query(None, description="要返回的KPI列，逗号分隔，如 rsrp,sinr；不传返回全部"),
        offset: int = Query(0, ge=0, description="分页偏移量，从第几条开始"),
        limit: int = Query(100, ge=1, le=1000, description="最多返回条数"),
):
    # 1. 先按条件全量过滤，得到所有符合条件的数据
    all_rows = filter_rows(scenario, start_time, end_time, ap_id, user_id)
    # 2. 总记录数 = 全量过滤后的数量，不受分页参数影响
    total = len(all_rows)
    # 3. 按分页参数切片，得到当前页数据
    page_rows = all_rows[offset: offset + limit]

    # 字段裁剪逻辑不变
    columns = ALL_COLUMNS
    if metrics:
        wanted = [m.strip() for m in metrics.split(",")]
        columns = ["timestamp"] + wanted
    records = [{k: r[k] for k in columns} for r in page_rows]

    return {
        "code": 0,
        "message": "success",
        "data": {
            "total": total,  # 修复：返回符合条件的总记录数
            "columns": columns,
            "records": records,  # 当前页数据
        },
    }


# ============ 接口2：多KPI联合故障研判 ============
class AnomalyRequest(BaseModel):
    scenario: str
    window_start: str
    window_end: str
    metrics: list[str] = ["rsrp", "sinr", "throughput"]

def build_candidates(ap, base, anomaly_type):
    """为单个AP的故障生成多候选原因与证据链（支持/反对/待验证），rank1 即主原因"""
    rsrp = base["rsrp_avg"]; sinr = base["sinr_avg"]; prb = base["prb_avg"]
    weak_r = base["weak_ratio"]; cong_r = base["cong_ratio"]
    c1 = min(0.99, 0.6 + 0.08 * len(base["evidence"]))

    if anomaly_type == "覆盖故障":
        return [
            {"rank": 1, "cause": f"{ap}天线倾角/发射功率不足，造成覆盖空洞",
             "confidence": round(c1, 2),
             "support_evidence": [f"弱覆盖采样占比{weak_r*100:.0f}%超过30%阈值",
                                  (f"RSRP均值{rsrp:.1f}dBm低于-105dBm" if rsrp < -105
                                   else f"RSRP均值{rsrp:.1f}dBm处于偏低水平")],
             "against_evidence": [f"SINR均值{sinr:.1f}dB正常，可排除强干扰因素" if sinr >= 5
                                  else f"SINR均值{sinr:.1f}dB也偏低，干扰因素暂不能排除"],
             "pending_checks": ["现场核查天线倾角与发射功率配置"]},
            {"rank": 2, "cause": f"{ap}周边新增遮挡物/环境变化导致信号衰减",
             "confidence": round(c1 * 0.7, 2),
             "support_evidence": ["故障呈时段性出现，与遮挡场景变化特征相符"],
             "against_evidence": [f"拥塞采样占比{cong_r*100:.0f}%较低，非负荷因素" if cong_r <= 0.25
                                  else f"拥塞采样占比{cong_r*100:.0f}%偏高，负荷因素需考虑"],
             "pending_checks": ["现场勘查周边遮挡物或建筑变更"]},
            {"rank": 3, "cause": f"{ap}邻区干扰或负荷牵引导致覆盖感知差",
             "confidence": round(c1 * 0.5, 2),
             "support_evidence": [f"PRB利用率{prb:.1f}%处于中高水平" if prb >= 50
                                  else f"PRB利用率{prb:.1f}%正常，干扰证据有限"],
             "against_evidence": [f"RSRP均值{rsrp:.1f}dBm与SINR{sinr:.1f}dB组合更指向覆盖问题"],
             "pending_checks": ["核查邻区PRB占用与切换参数"]},
        ]
    if anomaly_type == "网络拥塞":
        return [
            {"rank": 1, "cause": f"{ap}容量不足/接入用户过多导致拥塞",
             "confidence": round(c1, 2),
             "support_evidence": [f"拥塞采样占比{cong_r*100:.0f}%超过25%阈值",
                                  (f"PRB利用率均值{prb:.1f}%高于90%" if prb > 90
                                   else f"PRB利用率均值{prb:.1f}%处于偏高水平")],
             "against_evidence": [f"RSRP均值{rsrp:.1f}dBm正常，无线环境良好" if rsrp >= -105
                                  else f"RSRP均值{rsrp:.1f}dBm偏低，需叠加覆盖因素"],
             "pending_checks": ["核查活跃用户数与容量规划"]},
            {"rank": 2, "cause": f"{ap}业务突发/流量高峰导致瞬时拥塞",
             "confidence": round(c1 * 0.7, 2),
             "support_evidence": ["拥塞集中在特定时段，符合业务高峰特征"],
             "against_evidence": [f"弱覆盖采样占比{weak_r*100:.0f}%未超阈值，非覆盖因素" if weak_r <= 0.3
                                  else f"弱覆盖采样占比{weak_r*100:.0f}%偏高，覆盖因素需考虑"],
             "pending_checks": ["查看分时段流量分布与业务类型"]},
            {"rank": 3, "cause": f"{ap}回程/传输链路瓶颈",
             "confidence": round(c1 * 0.5, 2),
             "support_evidence": [f"吞吐量均值{base['thr_avg']:.1f}Mbps与PRB高占用不匹配" if base['thr_avg'] < 100
                                  else "吞吐量表现正常，回程瓶颈证据有限"],
             "against_evidence": [],
             "pending_checks": ["核查回程链路带宽与拥塞窗口"]},
        ]
    if anomaly_type == "边缘弱用户":
        return [
            {"rank": 1, "cause": f"{ap}用户位于覆盖边缘，信号质量差",
             "confidence": round(c1, 2),
             "support_evidence": [f"吞吐量均值{base['thr_avg']:.1f}Mbps低于50Mbps",
                                  f"SINR均值{sinr:.1f}dB偏低"],
             "against_evidence": [],
             "pending_checks": ["查看用户位置分布与终端能力"]},
            {"rank": 2, "cause": f"{ap}波束/参数配置未覆盖边缘区域",
             "confidence": round(c1 * 0.6, 2),
             "support_evidence": [f"RSRP均值{rsrp:.1f}dBm处于临界水平"],
             "against_evidence": [f"弱覆盖采样占比{weak_r*100:.0f}%未超30%阈值"],
             "pending_checks": ["核查波束配置与天线倾角"]},
        ]
    return [{"rank": 1, "cause": f"{ap}各项指标正常，无需处理", "confidence": round(0.95, 2),
             "support_evidence": [], "against_evidence": [], "pending_checks": []}]

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
                "suggestion": "建议检查AP天线倾角/功率或增加补盲AP",
                "candidates": build_candidates(ap, base, "覆盖故障")}
    if cong_ratio > 0.25 or prb_avg > 90:
        level = "严重" if cong_ratio > 0.5 else "中等"
        return {**base, "anomaly_type": "网络拥塞", "level": level, "network_status": "congestion",
                "cause": f"{ap}拥塞采样占比{cong_ratio*100:.0f}%、PRB利用率均值{prb_avg:.1f}%，判定为容量拥塞",
                "suggestion": "建议负载均衡或扩容",
                "candidates": build_candidates(ap, base, "网络拥塞")}
    if thr_avg < 50:
        return {**base, "anomaly_type": "边缘弱用户", "level": "中等", "network_status": "weak_coverage",
                "cause": f"{ap}吞吐量均值{thr_avg:.1f}Mbps偏低、SINR均值{sinr_avg:.1f}dB，判定为边缘弱用户",
                "suggestion": "建议用户靠近信号源或调整波束",
                "candidates": build_candidates(ap, base, "边缘弱用户")}
    return {**base, "anomaly_type": "正常", "level": "低", "network_status": "normal",
            "cause": f"{ap}各项指标均在正常范围", "suggestion": "无需处理",
            "candidates": build_candidates(ap, base, "正常")}

@app.post("/api/analyze/anomaly")
def analyze_anomaly(req: AnomalyRequest):
    # 第2周深化版：CSV真实数据，按AP分组多KPI联合研判（可解释证据链）
    # 新增：hourly_trend 小时趋势 / ap_comparison 多AP对比 / alarm_history 告警历史
    rows = filter_rows(req.scenario, req.window_start, req.window_end)
    if not rows:
        return {"code": 0, "message": "success",
                "data": {"is_anomaly": False, "reason": "该时间窗口无数据",
                         "cause": "该时间窗口无数据",
                         "hourly_trend": [], "ap_comparison": [], "alarm_history": []}}

    sev_rank = {"严重": 0, "中等": 1, "低": 9}

    # 1) 按 AP 分组研判 → 主结果
    by_ap = {}
    for r in rows:
        by_ap.setdefault(r["ap_id"], []).append(r)
    ap_results = [judge_ap(ap, ap_rows) for ap, ap_rows in sorted(by_ap.items())]
    findings = [res for res in ap_results if res["anomaly_type"] != "正常"]

    # 2) 按小时切片 → 趋势 + 时段级异常（回答"什么时候开始变差的"）
    by_hour = {}
    for r in rows:
        by_hour.setdefault(r["timestamp"][:13], []).append(r)  # "2026-01-01 10"
    hourly_trend = []
    hour_findings_all = []
    for hour in sorted(by_hour):
        hour_by_ap = {}
        for r in by_hour[hour]:
            hour_by_ap.setdefault(r["ap_id"], []).append(r)
        hour_res = [judge_ap(ap, ap_rows) for ap, ap_rows in hour_by_ap.items()]
        hour_findings = [x for x in hour_res if x["anomaly_type"] != "正常"]
        hour_findings_all.extend(hour_findings)
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

    if findings:
        findings.sort(key=lambda f: sev_rank.get(f["level"], 9))
        m = findings[0]
        is_anomaly, anomaly_type, level = True, m["anomaly_type"], m["level"]
        evidence, cause, suggestion = m["evidence"], m["cause"], m["suggestion"]
        nstatus, affected_aps = m["network_status"], [f["ap_id"] for f in findings]
        candidates = m.get("candidates", [])
        ap_candidates = [{"ap_id": f["ap_id"], "candidates": f["candidates"]} for f in findings]
        confidence = round(min(0.99, 0.6 + 0.08 * len(evidence) + (0.1 if len(findings) > 1 else 0)), 2)
    elif hour_findings_all:
        # 整窗均值被正常时段稀释判"正常"，但存在时段性异常（小时级）
        # → 主结果升级为最严重的小时异常，避免"有告警却说正常"的矛盾
        hour_findings_all.sort(key=lambda f: sev_rank.get(f["level"], 9))
        m = hour_findings_all[0]
        is_anomaly, anomaly_type, level = True, m["anomaly_type"], m["level"]
        evidence, cause, suggestion = m["evidence"], m["cause"], m["suggestion"]
        nstatus, affected_aps = m["network_status"], [m["ap_id"]]
        candidates = m.get("candidates", [])
        ap_candidates = [{"ap_id": f["ap_id"], "candidates": f["candidates"]} for f in hour_findings_all]
        confidence = round(min(0.99, 0.6 + 0.08 * len(evidence) + 0.1), 2)
    else:
        rsrp_avg = avg(rows, "rsrp"); sinr_avg = avg(rows, "sinr")
        thr_avg = avg(rows, "throughput"); prb_avg = avg(rows, "prb_usage")
        is_anomaly, anomaly_type, level = False, "正常", "低"
        evidence = []
        cause = (f"各AP的RSRP均值{rsrp_avg:.1f}dBm、SINR均值{sinr_avg:.1f}dB、PRB利用率{prb_avg:.1f}%、"
                 f"吞吐量均值{thr_avg:.1f}Mbps，各项指标均在正常范围")
        suggestion, nstatus, affected_aps = "无需处理", "normal", []
        candidates = []
        ap_candidates = []
        confidence = 0.95

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
            "candidates": candidates,
            "ap_candidates": ap_candidates,
            "hourly_trend": hourly_trend,        # 新增：小时级趋势
            "ap_comparison": ap_comparison,      # 新增：多AP横向对比
            "alarm_history": alarm_history,      # 新增：告警历史
        },
    }

# ============ 关键词规则库（API降级独立路径，不依赖LLM） ============
KEYWORD_RULES = {
    "query_kpi": [
        # 通用查询
        "查一下", "整体情况", "概况", "kpi", "指标", "运行情况", "网络状态",
        "数据概况", "当前情况", "整体网络", "网络怎么样", "基本情况", "看看数据",
        "随便", "看看", "随便看看", "随便说点", "有什么", "介绍一下",
        # 指标类直查
        "rsrp", "sinr", "吞吐量", "时延", "丢包率", "prb利用率", "信号强度"
    ],
"fault_diagnosis": [
    # 通用故障类
    "异常", "故障", "问题", "拥塞", "掉线", "差", "不好", "排查",
    "分析异常", "有没有问题", "故障诊断", "什么原因", "为什么", "定位问题",
    # 覆盖类细分
    "弱覆盖", "覆盖差", "信号差", "信号弱", "覆盖空洞", "信号不好",
    # 容量类细分
    "拥塞", "容量不足", "用户多", "卡", "慢", "prb高",
    # 时延/丢包类细分
    "时延高", "延迟大", "时延大", "ping高", "丢包", "丢包率高", "断连",
    # 速率类细分
    "吞吐量低", "带宽不足", "速率低", "网速慢", "速率差"
    ],
    "get_heatmap": [
        "热力图", "热图", "信号分布", "覆盖图", "信号热力", "覆盖热力", "热力分布",
        "信号覆盖情况", "覆盖分布", "场强分布"
    ],
    "get_topology": [
        "拓扑", "结构", "连接关系", "节点", "链路", "网络拓扑", "拓扑结构", "组网",
        "设备连接", "有哪些设备", "基站分布"
    ]
}


def match_intent_by_keyword(message: str) -> str | None:
    msg = message.lower()
    best_intent = None
    max_len = 0
    for intent, keywords in KEYWORD_RULES.items():
        for kw in keywords:
            if kw in msg and len(kw) > max_len:
                max_len = len(kw)
                best_intent = intent
    return best_intent

# ============ 接口3：自然语言对话（LLM 意图 → Function Calling 工具注册表分发） ============
class ChatRequest(BaseModel):
    message: str
    session_id: str = "sess_001"
    scenario: str = "校园"

VALID_SCENARIOS = ("校园", "商场", "体育馆")

def resolve_scenario(params_scenario, default_scenario):
    """场景白名单校验：LLM 可能把"A区"之类当成场景，无效则回退请求默认场景"""
    return params_scenario if params_scenario in VALID_SCENARIOS else default_scenario

# ---- 工具1：KPI 概况查询（真实 CSV 均值） ----
def tool_query_kpi(scenario: str) -> dict:
    win_start, win_end = "2026-01-01 00:00:00", "2026-01-03 23:59:59"
    rows = filter_rows(scenario, win_start, win_end)
    if rows:
        reply = (f"当前时段网络整体运行平稳：RSRP均值{avg(rows,'rsrp'):.1f}dBm，"
                 f"SINR均值{avg(rows,'sinr'):.1f}dB，平均吞吐量{avg(rows,'throughput'):.1f}Mbps，"
                 f"PRB利用率{avg(rows,'prb_usage'):.1f}%，共{len(rows)}条采样。")
    else:
        reply = f"未找到场景「{scenario}」在所选时段的数据。"
    return {"reply": reply, "intent": "query_kpi", "chart": None,
            "query_ref": {"scenario": scenario}}

# ---- 工具2：故障研判（意图 → 确定性规则引擎=接口2，LLM 不参与计算，规避幻觉） ----
def tool_fault_diagnosis(scenario: str) -> dict:
    win_start, win_end = "2026-01-01 00:00:00", "2026-01-03 23:59:59"
    an = analyze_anomaly(AnomalyRequest(scenario=scenario,
                                        window_start=win_start, window_end=win_end))
    d = an["data"]
    if d.get("is_anomaly"):
        reply = f"检测到{d['anomaly_type']}（{d['level']}）：{d['cause']}。建议：{d['suggestion']}。"
    else:
        reply = f"当前时段未发现明显异常：{d.get('cause', d.get('reason', '暂无数据'))}。"
    chart = {
        "type": "line",
        "option": {
            "xAxis": {"data": [h["hour"] for h in d["hourly_trend"]]},
            "series": [{"name": "RSRP(dBm)", "data": [h["rsrp_avg"] for h in d["hourly_trend"]]}],
        },
    }
    return {"reply": reply, "intent": "fault_diagnosis", "chart": chart,
            "detail": d, "query_ref": {"scenario": scenario,
                                       "start_time": win_start, "end_time": win_end}}

# ---- 工具3：热力图（真实：按 UE 坐标网格聚合 RSRP，ECharts heatmap 直接渲染） ----
def tool_heatmap(scenario: str) -> dict:
    win_start, win_end = "2026-01-01 00:00:00", "2026-01-03 23:59:59"
    rows = filter_rows(scenario, win_start, win_end)
    if not rows:
        return {"reply": f"未找到场景「{scenario}」的数据，暂无法生成热力图。",
                "intent": "get_heatmap", "chart": None, "query_ref": {"scenario": scenario}}
    # 监测区域（与 data_generator.py MAP_RANGE 一致）与网格大小
    x_min, x_max, y_min, y_max = 20.0, 480.0, 20.0, 430.0
    grid = 40.0  # 40m×40m → 12列×11行
    nx = int((x_max - x_min) // grid) + 1
    ny = int((y_max - y_min) // grid) + 1
    # 网格聚合：ue_x/ue_y → RSRP 均值
    acc = {}  # (ix, iy) -> [sum_rsrp, count]
    for r in rows:
        try:
            ux, uy, rsrp = float(r["ue_x"]), float(r["ue_y"]), float(r["rsrp"])
        except Exception:
            continue
        ix = min(int((ux - x_min) // grid), nx - 1)
        iy = min(int((uy - y_min) // grid), ny - 1)
        s, c = acc.get((ix, iy), (0.0, 0))
        acc[(ix, iy)] = (s + rsrp, c + 1)
    x_labels = [round(x_min + i * grid, 1) for i in range(nx)]
    y_labels = [round(y_min + i * grid, 1) for i in range(ny)]
    data = [[ix, iy, round(s / c, 2)] for (ix, iy), (s, c) in sorted(acc.items())]
    option = {
        "tooltip": {"position": "top"},
        "grid": {"height": "60%", "top": "10%"},
        "xAxis": {"type": "category", "data": x_labels, "name": "X(m)",
                  "splitArea": {"show": True}},
        "yAxis": {"type": "category", "data": y_labels, "name": "Y(m)",
                  "splitArea": {"show": True}},
        "visualMap": {
            "min": -120, "max": -60, "calculable": True, "orient": "horizontal",
            "left": "center", "bottom": "2%", "text": ["强", "弱"],
            "inRange": {"color": ["#313695", "#4575b4", "#74add1", "#abd9e9",
                                  "#e0f3f8", "#fee090", "#fdae61", "#f46d43", "#d73027"]},
        },
        "series": [{
            "name": "RSRP(dBm)", "type": "heatmap", "data": data,
            "label": {"show": False},
            "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0,0,0,0.5)"}},
        }],
    }
    return {"reply": f"已生成「{scenario}」信号热力图：{len(data)}个采样网格，覆盖 X {x_min}~{x_max}m、Y {y_min}~{y_max}m。",
            "intent": "get_heatmap", "chart": {"type": "heatmap", "option": option},
            "detail": {"grid_count": len(data), "grid_size": grid,
                       "x_range": [x_min, x_max], "y_range": [y_min, y_max],
                       "scenario": scenario},
            "query_ref": {"scenario": scenario, "start_time": win_start, "end_time": win_end}}

# ---- 工具4：网络拓扑（基于 CSV 真实连接关系：AP 服务了哪些 UE） ----
def tool_topology(scenario: str) -> dict:
    win_start, win_end = "2026-01-01 00:00:00", "2026-01-03 23:59:59"
    rows = filter_rows(scenario, win_start, win_end)
    if not rows:
        return {"reply": f"未找到场景「{scenario}」的数据，暂无法生成拓扑。",
                "intent": "get_topology", "chart": None, "query_ref": {"scenario": scenario}}
    ap_set = sorted({r["ap_id"] for r in rows})
    ue_set = sorted({r["user_id"] for r in rows})
    links, seen = [], set()
    for r in rows:
        key = (r["ap_id"], r["user_id"])
        if key not in seen:
            seen.add(key)
            links.append({"source": r["ap_id"], "target": r["user_id"]})
    nodes = [{"id": ap, "category": "AP"} for ap in ap_set] + \
            [{"id": ue, "category": "UE"} for ue in ue_set]
    return {"reply": f"已生成「{scenario}」的网络拓扑：{len(ap_set)}个AP、{len(ue_set)}个UE、{len(links)}条连接。",
            "intent": "get_topology",
            "chart": {"type": "graph", "option": {"nodes": nodes, "links": links}},
            "detail": {"node_count": len(nodes), "link_count": len(links), "scenario": scenario},
            "query_ref": {"scenario": scenario}}

# ---- Function Calling 工具注册表：意图名 → 工具函数（新增工具在这里登记即可） ----
TOOLS = {
    "query_kpi": tool_query_kpi,
    "fault_diagnosis": tool_fault_diagnosis,
    "get_heatmap": tool_heatmap,
    "get_topology": tool_topology,
}


# 开关：可配置是否启用LLM增强，LLM故障时设为False即可纯规则运行

ENABLE_LLM = True


@app.post("/api/agent/chat")
def agent_chat(req: ChatRequest):
    # 1. 第一层：关键词规则匹配（独立主路径，完全不依赖LLM）
    intent = match_intent_by_keyword(req.message)
    params = {}

    # 2. 第二层：关键词未命中 + 启用LLM时，才调用大模型增强识别
    if not intent and ENABLE_LLM:
        try:
            intent_obj = get_intent(req.message)
            intent = intent_obj.get("intent", "query_kpi")
            params = intent_obj.get("params", {})
        except Exception:
            # LLM调用失败，自动降级，不抛出错误
            intent = "query_kpi"

    # 3. 第三层：最终兜底，任何非法/未知意图全部回退KPI查询
    if intent not in TOOLS:
        intent = "query_kpi"

    # 4. 执行工具，输出格式和正常链路完全一致
    scenario = resolve_scenario(params.get("scenario"), req.scenario)
    handler = TOOLS.get(intent, TOOLS["query_kpi"])
    data = handler(scenario)
    return {"code": 0, "message": "success", "data": data}


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

# ========== 热力图数据接口 ==========
@app.get("/api/data/heatmap", summary="信号热力图数据")
def get_heatmap(
    scenario: str = Query(..., description="场景名，如：校园"),
    start_time: str | None = Query(None, description="开始时间"),
    end_time: str | None = Query(None, description="结束时间"),
    metric: str = Query("rsrp", description="热力指标：rsrp / sinr")
):
    # 1. 复用已加载数据集，按条件过滤
    rows = filter_rows(
        scenario,
        start_time or "2026-01-01 00:00:00",
        end_time or "2026-12-31 23:59:59"
    )

    if not rows:
        return {
            "code": 0,
            "message": "success",
            "data": {"metric": metric, "grid_count": 0, "values": []}
        }

    # 2. 按AP坐标聚合，计算平均信号值
    grid_map = {}
    for r in rows:
        key = (r["ap_x"], r["ap_y"])
        if key not in grid_map:
            grid_map[key] = []
        grid_map[key].append(float(r[metric]))

    # 3. 转成前端ECharts直接能用的格式
    result = []
    for (x, y), values in grid_map.items():
        avg_val = sum(values) / len(values)
        result.append([float(x), float(y), round(avg_val, 2)])

    return {
        "code": 0,
        "message": "success",
        "data": {
            "metric": metric,
            "grid_count": len(result),
            "values": result
        }
    }

# ========== 基础网络拓扑数据接口 ==========
@app.get("/api/network/topology/basic", summary="基础网络拓扑数据")
def get_basic_topology(
    scenario: str = Query(..., description="场景名"),
    timestamp: str | None = Query(None, description="指定时刻，默认取第一条数据的时刻")
):
    # 1. 复用已加载数据集
    rows = filter_rows(scenario, "2026-01-01 00:00:00", "2026-12-31 23:59:59")

    if not rows:
        return {"code": 0, "message": "success", "data": {"nodes": [], "links": []}}

    # 2. 默认取第一个时刻的拓扑
    if not timestamp:
        timestamp = rows[0]["timestamp"]
    rows = [r for r in rows if r["timestamp"] == timestamp]

    # 3. 构造节点列表（AP + UE）
    nodes = []
    ap_seen = set()
    ue_seen = set()
    for r in rows:
        if r["ap_id"] not in ap_seen:
            ap_seen.add(r["ap_id"])
            nodes.append({
                "id": r["ap_id"],
                "type": "ap",
                "x": float(r["ap_x"]),
                "y": float(r["ap_y"])
            })
        if r["user_id"] not in ue_seen:
            ue_seen.add(r["user_id"])
            nodes.append({
                "id": r["user_id"],
                "type": "ue",
                "x": float(r["ue_x"]),
                "y": float(r["ue_y"])
            })

    # 4. 构造链路列表（AP-UE连接关系）
    links = []
    link_seen = set()
    for r in rows:
        key = (r["ap_id"], r["user_id"])
        if key not in link_seen:
            link_seen.add(key)
            links.append({
                "source": r["ap_id"],
                "target": r["user_id"],
                "rsrp": float(r["rsrp"]),
                "sinr": float(r["sinr"]),
                "throughput": float(r["throughput"])
            })

    return {
        "code": 0,
        "message": "success",
        "data": {
            "timestamp": timestamp,
            "nodes": nodes,
            "links": links
        }
    }
