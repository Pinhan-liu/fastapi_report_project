# API 接口文档

Base URL: http://localhost:8000
数据格式: JSON (UTF-8)
时间格式: "yyyy-MM-dd HH:mm:ss"
单位: rsrp(dBm) sinr(dB) throughput(Mbps) latency(ms) packet_loss(%) prb_usage(%)

## 接口总览

| 接口 | 方法 | 路径 | 用途 |
|---|---|---|---|
| 1 | GET | /api/data/query | 查询监测数据 |
| 2 | POST | /api/analyze/anomaly | 多KPI联合故障研判 |
| 3 | POST | /api/agent/chat | 自然语言对话 |
| 4 | POST | /api/export/report | 导出分析报告 |

## 通用响应格式

成功: {"code": 0, "message": "success", "data": {...}}
失败: {"code": 40001, "message": "参数错误：缺少scenario", "data": null}
错误码约定: 0=成功 400xx=参数错误 500xx=服务端错误

## 接口1：查询监测数据

GET /api/data/query?scenario=校园&start_time=2026-09-28 00:00:00&end_time=2026-09-28 23:59:59&ap_id=AP-01&limit=100

可选参数: metrics=rsrp,sinr,throughput（不传则返回全部KPI列）

响应:

{
  "code": 0,
  "message": "success",
  "data": {
    "total": 120,
    "columns": ["timestamp", "ap_id", "user_id", "rsrp", "sinr", "throughput", "network_status"],
    "records": [
      {"timestamp": "2026-09-28 10:00:00", "ap_id": "AP-01", "user_id": "UE-001", "rsrp": -95, "sinr": 8.5, "throughput": 12.3, "network_status": "normal"},
      {"timestamp": "2026-09-28 10:00:05", "ap_id": "AP-01", "user_id": "UE-001", "rsrp": -105, "sinr": 3.2, "throughput": 4.1, "network_status": "congestion"}
    ]
  }
}

## 接口2：多KPI联合故障研判

POST /api/analyze/anomaly

请求:

{
  "scenario": "校园",
  "window_start": "2026-09-28 10:00:00",
  "window_end": "2026-09-28 10:10:00",
  "metrics": ["rsrp", "sinr", "throughput", "latency"]
}

响应:

{
  "code": 0,
  "message": "success",
  "data": {
    "is_anomaly": true,
    "anomaly_type": "覆盖恶化",
    "level": "严重",
    "confidence": 0.87,
    "kpi_evidence": [
      {"metric": "rsrp", "avg_value": -108, "threshold": -100, "status": "异常"},
      {"metric": "throughput", "avg_value": 2.3, "threshold": 10, "status": "异常"}
    ],
    "cause": "AP-01覆盖范围内用户RSRP持续低于-100dBm，SINR同步恶化，判定为覆盖空洞风险",
    "suggestion": "建议检查AP-01天线倾角或增加补盲AP",
    "affected_aps": ["AP-01", "AP-02"],
    "network_status": "weak_coverage"
  }
}

## 接口3：自然语言对话

POST /api/agent/chat

请求:

{
  "message": "帮我看看10点到10点10分网络有没有问题",
  "session_id": "sess_001",
  "scenario": "校园"
}

响应:

{
  "code": 0,
  "message": "success",
  "data": {
    "reply": "10:00-10:10时段检测到异常：RSRP均值-108dBm低于正常阈值，吞吐量仅2.3Mbps，判定为覆盖恶化（置信度0.87），建议检查AP-01天线。",
    "intent": "anomaly_query",
    "chart": {
      "type": "line",
      "option": {
        "xAxis": {"data": ["10:00", "10:02", "10:04", "10:06", "10:08", "10:10"]},
        "series": [{"name": "RSRP", "data": [-95, -101, -108, -110, -106, -102]}]
      }
    },
    "query_ref": {"scenario": "校园", "start_time": "2026-09-28 10:00:00", "end_time": "2026-09-28 10:10:00"}
  }
}

## 接口4：导出分析报告

POST /api/export/report

请求:

{
  "scenario": "校园",
  "start_time": "2026-09-28 00:00:00",
  "end_time": "2026-09-28 23:59:59",
  "format": "md",
  "include_chart": true
}

响应:

{
  "code": 0,
  "message": "success",
  "data": {
    "report_id": "RPT_20260928_01",
    "file_url": "/download/reports/RPT_20260928_01.md"
  }
}
