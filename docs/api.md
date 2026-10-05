# API 接口文档
Base URL: http://localhost:8000
数据格式: JSON (UTF-8)
时间格式: "yyyy-MM-dd HH:mm:ss"
单位: rsrp(dBm) sinr(dB) throughput(Mbps) latency(ms) packet_loss(%) prb_usage(%)

## 接口总览
|接口|方法|路径|用途|
|---|---|---|---|
|1|GET|/api/data/query|查询监测数据|
|2|POST|/api/analyze/anomaly|多 KPI 联合故障研判|
|3|POST|/api/agent/chat|自然语言对话|
|4|POST|/api/export/report|导出分析报告|
|5|GET|/api/data/heatmap|信号热力图数据|
|6|GET|/api/network/topology/basic|基础网络拓扑数据|
|7|GET|/api/data/realtime|实时增量监测数据|

## 通用响应格式
成功: {"code": 0, "message": "success", "data": {...}}
失败: {"code": 40001, "message": "参数错误：缺少scenario", "data": null}

错误码约定:
|错误码|类型|说明|
|---|---|---|
|0|成功|请求处理成功|
|40001|参数错误|必填参数缺失|
|40002|参数错误|参数格式非法|
|40003|参数错误|参数值超出合法范围|
|50001|服务端错误|服务内部异常|

## 接口1：查询监测数据
GET /api/data/query?scenario=校园&start_time=2026-09-28 00:00:00&end_time=2026-09-28 23:59:59&ap_id=AP-01&limit=100
可选参数: metrics=rsrp,sinr,throughput（不传则返回全部KPI列）

响应:
```json
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
```

## 接口 2：多 KPI 联合故障研判

POST /api/analyze/anomaly

请求:

```json
{
  "scenario": "校园",
  "window_start": "2026-01-01 00:00:00",
  "window_end": "2026-01-03 23:59:59",
  "metrics": ["rsrp", "sinr", "throughput", "prb_usage"]
}
```

响应（v2：含多候选原因 \+ 证据链）:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "is_anomaly": true,
    "anomaly_type": "覆盖故障",
    "level": "严重",
    "confidence": 0.86,
    "kpi_evidence": [
      {"metric": "rsrp", "avg_value": -115.8, "threshold": -105, "status": "异常"}
    ],
    "cause": "AP-02弱覆盖采样占比79%、RSRP均值-115.8dBm，判定为覆盖空洞",
    "suggestion": "建议检查AP天线倾角/功率或增加补盲AP",
    "affected_aps": ["AP-02"],
    "network_status": "weak_coverage",
    "candidates": [
      {
        "rank": 1,
        "cause": "AP-02天线倾角/发射功率不足，造成覆盖空洞",
        "confidence": 0.76,
        "support_evidence": ["弱覆盖采样占比79%超过30%阈值", "RSRP均值-115.8dBm低于-105dBm"],
        "against_evidence": ["SINR均值-8.3dB也偏低，干扰因素暂不能排除"],
        "pending_checks": ["现场核查天线倾角与发射功率配置"]
      },
      {
        "rank": 2,
        "cause": "AP-02周边新增遮挡物/环境变化导致信号衰减",
        "confidence": 0.53,
        "support_evidence": ["故障呈时段性出现，与遮挡场景变化特征相符"],
        "against_evidence": ["拥塞采样占比0%较低，非负荷因素"],
        "pending_checks": ["现场勘查周边遮挡物或建筑变更"]
      },
      {
        "rank": 3,
        "cause": "AP-02邻区干扰或负荷牵引导致覆盖感知差",
        "confidence": 0.38,
        "support_evidence": ["PRB利用率42.5%正常，干扰证据有限"],
        "against_evidence": ["RSRP均值-115.8dBm与SINR-8.3dB组合更指向覆盖问题"],
        "pending_checks": ["核查邻区PRB占用与切换参数"]
      }
    ],
    "ap_candidates": [
      {"ap_id": "AP-02", "candidates": [{"rank": 1, "cause": "...", "confidence": 0.76, "support_evidence": [...], "against_evidence": [...], "pending_checks": [...]}]}
    ],
    "hourly_trend": [
      {"hour": "2026-01-01 10", "anomaly_type": "覆盖故障", "level": "中等",
       "network_status": "weak_coverage", "rsrp_avg": -101.1, "sinr_avg": 10.1, "thr_avg": 408.3, "prb_avg": 57.1}
    ],
    "ap_comparison": [
      {"ap_id": "AP-01", "rsrp_avg": -99.9, "sinr_avg": 10.4, "thr_avg": 391.5, "prb_avg": 52.2,
       "weak_ratio": 0.326, "cong_ratio": 0.027, "anomaly_type": "覆盖故障", "level": "中等"}
    ],
    "alarm_history": [
      {"time": "2026-01-01 23", "ap_id": "AP-01", "anomaly_type": "覆盖故障",
       "level": "中等", "cause": "AP-01弱覆盖采样占比48%、RSRP均值-106.2dBm，判定为覆盖空洞"}
    ]
  }
}
```

### 接口 2 字段说明（v2 新增）

|字段|类型|说明|
|---|---|---|
|candidates|array|主异常 AP 的多候选原因（rank1 即主结论）。每项含 cause /confidence/support\_evidence（支持证据）/against\_evidence（反对证据）/pending\_checks（待验证项）|
|ap\_candidates|array|所有异常 AP 的证据链汇总，每项 \{ap\_id, candidates\}，供前端证据链图按 AP 展开|
|hourly\_trend|array|小时级趋势（回答 "何时开始变差"），每项含 hour \+ 该小时最严重异常的类型 / 等级 / KPI 均值|
|ap\_comparison|array|多 AP 横向对比（哪台 AP 最差），含 weak\_ratio/cong\_ratio|
|alarm\_history|array|小时 ×AP 告警历史（倒序，最多 50 条）|
|kpi\_evidence|array|命中的 KPI 异常证据（metric/avg\_value/threshold/status）|

## 接口 3：自然语言对话

POST /api/agent/chat

请求:

```json
{
  "message": "帮我看看10点到10点10分网络有没有问题",
  "session_id": "sess_001",
  "scenario": "校园"
}
```

响应:

```json
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
```

## 接口 4：导出分析报告

POST /api/export/report

请求:

```json
{
  "scenario": "校园",
  "start_time": "2026-09-28 00:00:00",
  "end_time": "2026-09-28 23:59:59",
  "format": "md",
  "include_chart": true
}
```

响应:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "report_id": "RPT_20260928_01",
    "file_url": "/download/reports/RPT_20260928_01.md"
  }
}
```

## 接口 5：信号热力图数据

GET /api/data/heatmap?scenario = 校园 \& start\_time=2026\-01\-01 00:00:00\&end\_time=2026\-01\-03 23:59:59\&metric=rsrp

可选参数:

- `start_time` / `end_time`：时间范围，不传则覆盖全量数据

- `metric`：热力指标，可选 `rsrp` / `sinr`，默认 `rsrp`

响应:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "metric": "rsrp",
    "grid_count": 3,
    "values": [
      [120, 220, -92.54],
      [380, 160, -92.51],
      [260, 350, -92.27]
    ]
  }
}
```

### 接口 5 字段说明

|字段|类型|说明|
|---|---|---|
|metric|string|本次热力图的指标类型|
|grid\_count|int|网格点位总数|
|values|array|网格点位数组，每项格式为 `[x坐标, y坐标, 指标均值]`，可直接接入 ECharts heatmap 渲染|

## 接口 6：基础网络拓扑数据

GET /api/network/topology/basic?scenario = 校园 \& timestamp=2026\-01\-01 00:00:00

可选参数:

- `timestamp`：指定时刻，不传则默认取第一条数据的时刻

响应:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "timestamp": "2026-01-01 00:00:00",
    "nodes": [
      {"id": "AP-01", "type": "ap", "x": 120, "y": 220},
      {"id": "UE-01", "type": "ue", "x": 94.8, "y": 192.62},
      {"id": "AP-02", "type": "ap", "x": 380, "y": 160},
      {"id": "UE-02", "type": "ue", "x": 372.32, "y": 129.2}
    ],
    "links": [
      {"source": "AP-01", "target": "UE-01", "rsrp": -92.5, "sinr": 10.2, "throughput": 128.5},
      {"source": "AP-02", "target": "UE-02", "rsrp": -91.8, "sinr": 11.5, "throughput": 135.2}
    ]
  }
}
```

### 接口 6 字段说明

|字段|类型|说明|
|---|---|---|
|timestamp|string|本次拓扑对应的时刻|
|nodes|array|节点列表，包含 AP 与 UE 两类；每项含 `id` / `type` / `x` / `y`|
|links|array|AP\-UE 连接链路列表；每项含两端节点 ID 及 `rsrp` / `sinr` / `throughput` 核心指标|

## 接口 7：实时增量监测数据

GET /api/data/realtime?last\_time=2026\-10\-06 00:00:00

可选参数:

- `last_time`：上次拉取的最大时间戳，格式 `yyyy-MM-dd HH:mm:ss`；不传则默认返回最近 10 条数据

响应:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 3,
    "columns": ["timestamp", "ap_id", "user_id", "rsrp", "sinr", "throughput", "network_status"],
    "records": [
      {"timestamp": "2026-10-06 18:00:00", "ap_id": "AP-01", "user_id": "UE-03", "rsrp": -91.2, "sinr": 6.3, "throughput": 54.7, "network_status": "normal"},
      {"timestamp": "2026-10-06 18:00:00", "ap_id": "AP-02", "user_id": "UE-05", "rsrp": -94.8, "sinr": 5.7, "throughput": 49.2, "network_status": "normal"},
      {"timestamp": "2026-10-06 18:00:00", "ap_id": "AP-03", "user_id": "UE-07", "rsrp": -89.5, "sinr": 7.1, "throughput": 59.8, "network_status": "congestion"}
    ]
  }
}
```

### 接口 7 字段说明

|字段|类型|说明|
|---|---|---|
|total|int|本次返回的增量数据条数|
|columns|array|字段名列表，与历史查询接口完全一致，可复用前端解析逻辑|
|records|array|增量数据数组，所有数据的时间戳均大于请求传入的 `last_time`|

**错误码说明**：

- `0`：成功

- `40002`：参数错误，时间格式非法

- `50001`：服务端内部异常
