# main.py —— AI-NetTune 后端：4个接口全打通（第一周 mock 版）
# 后续替换计划：
#   - 接口1/接口2：第2周换成唐苗的CSV数据源 + 真实多KPI研判逻辑
#   - 接口3：第3周把关键词规则换成大模型API（LLM意图驱动）
#   - 接口4：第3周接入真实报告生成
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import datetime

app = FastAPI()

# 允许前端(React dev server 5173)跨域调用本后端
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://10.63.118.174:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ 模拟数据源（第一周跑通链路用，后续换唐苗的CSV） ============
MOCK_RECORD = {
    "timestamp": "2026-09-28 10:00:00",
    "ap_id": "AP-01",
    "user_id": "UE-001",
    "rsrp": -95,
    "sinr": 8.5,
    "throughput": 12.3,
    "latency": 20,
    "packet_loss": 0.5,
    "prb_usage": 60,
    "scenario": "校园",
    "network_status": "normal",
}


# ============ 接口1：查询监测数据 ============
@app.get("/api/data/query")
def data_query(
    scenario: str = Query(..., description="场景，如：校园"),
    start_time: str = Query("2026-09-28 00:00:00", description="开始时间"),
    end_time: str = Query("2026-09-28 23:59:59", description="结束时间"),
    ap_id: str | None = Query(None, description="AP编号，不传查全部"),
    user_id: str | None = Query(None, description="用户编号，不传查全部"),
    metrics: str | None = Query(None, description="要返回的KPI列，逗号分隔，如 rsrp,sinr；不传返回全部"),
    limit: int = Query(100, ge=1, le=1000, description="最多返回条数"),
):
    # mock：先返回一条模拟数据；第2周换成唐苗从CSV读取的真实查询
    record = dict(MOCK_RECORD)
    record["scenario"] = scenario
    record["timestamp"] = start_time

    columns = ["timestamp", "ap_id", "user_id", "rsrp", "sinr", "throughput",
               "latency", "packet_loss", "prb_usage", "scenario", "network_status"]
    if metrics:
        wanted = [m.strip() for m in metrics.split(",")]
        columns = ["timestamp"] + wanted

    # 按请求的列裁剪记录
    filtered = {k: record[k] for k in columns if k in record}

    return {
        "code": 0,
        "message": "success",
        "data": {
            "total": 1,
            "columns": columns,
            "records": [filtered],
        },
    }


# ============ 接口2：多KPI联合故障研判 ============
class AnomalyRequest(BaseModel):
    scenario: str
    window_start: str
    window_end: str
    metrics: list[str] = ["rsrp", "sinr", "throughput"]


@app.post("/api/analyze/anomaly")
def analyze_anomaly(req: AnomalyRequest):
    # 这里先用假数据返回，跑通链路；第2周换成唐苗的真实研判逻辑
    return {
        "code": 0,
        "message": "success",
        "data": {
            "is_anomaly": True,
            "anomaly_type": "覆盖恶化",
            "level": "严重",
            "confidence": 0.87,
            "kpi_evidence": [
                {"metric": "rsrp", "avg_value": -108, "threshold": -100, "status": "异常"}
            ],
            "cause": "RSRP持续低于-100dBm，判定为覆盖空洞风险",
            "suggestion": "建议检查AP-01天线倾角或增加补盲AP",
            "affected_aps": ["AP-01"],
            "network_status": "weak_coverage"
        }
    }


# ============ 接口3：自然语言对话 ============
class ChatRequest(BaseModel):
    message: str
    session_id: str = "sess_001"
    scenario: str = "校园"


@app.post("/api/agent/chat")
def agent_chat(req: ChatRequest):
    # 第一周：规则版意图识别（演示"意图驱动"雏形；第3周换成大模型API）
    # 命中异常关键词 → 判为异常查询意图，返回研判结论 + 图表
    anomaly_keywords = ["异常", "问题", "故障", "卡", "不好", "差", "掉线", "信号弱", "网络"]
    if any(k in req.message for k in anomaly_keywords):
        return {
            "code": 0,
            "message": "success",
            "data": {
                "reply": "检测到网络异常：RSRP均值-108dBm低于正常阈值（-100dBm），吞吐量仅2.3Mbps，判定为覆盖恶化（置信度0.87），建议检查AP-01天线倾角或增加补盲AP。",
                "intent": "anomaly_query",
                "chart": {
                    "type": "line",
                    "option": {
                        "xAxis": {"data": ["10:00", "10:02", "10:04", "10:06", "10:08", "10:10"]},
                        "series": [{"name": "RSRP", "data": [-95, -101, -108, -110, -106, -102]}]
                    }
                },
                "query_ref": {
                    "scenario": req.scenario,
                    "start_time": "2026-09-28 10:00:00",
                    "end_time": "2026-09-28 10:10:00",
                },
            },
        }

    # 默认：普通数据查询意图
    return {
        "code": 0,
        "message": "success",
        "data": {
            "reply": "当前时段网络整体运行平稳：RSRP均值-95dBm，SINR均值8.5dB，平均吞吐量12.3Mbps，未发现明显异常。",
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
