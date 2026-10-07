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
|8|GET|/api/predict/result|时序预测结果查询（契约v1·占位实现）|
|9|GET|/api/network/topology/enhanced|拓扑增强数据（契约v1）|
|10|POST|/api/analyze/forecast|区域信号/频谱态势预测（Prophet 时序模型）|

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
 offset: 分页偏移量，默认0，从第0条开始
limit: 单页最大条数，默认100，最大1000
 metrics: 返回字段裁剪，逗号分隔，如 rsrp,sinr,throughput；不传则返回全部18列


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
说明：`total` 为符合筛选条件的总记录数，不受分页参数影响，用于前端计算总页数。

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



### 降级机制
1.  关键词规则优先匹配，不依赖LLM即可完成意图识别
2.  未命中关键词、输入模糊时，默认兜底为 `query_kpi`（KPI概况查询）
3.  LLM不可用时，自动降级为关键词规则+兜底逻辑，核心功能可用

### chart 图表类型
- `line`：折线趋势图，对应故障研判场景
- `heatmap`：热力图，对应信号分布场景
- `graph`：关系图，对应网络拓扑场景

---

## 接口 8：时序预测结果查询（预测结果接口契约 v1）

GET /api/predict/result?scenario=校园&start_time=2026-01-04 00:00:00&end_time=2026-01-04 23:59:59&target_type=ap&target_id=AP-01&metric=rsrp

功能：根据时间范围、预测对象与指标，返回时序预测结果（预测值、置信区间与状态标注）。
当前为契约 v1 + 占位实现阶段：后端返回固定空结构，不接入真实预测模型；模型（Prophet/LSTM）就绪后替换内部逻辑，字段契约不变。

### 请求参数

|参数|类型|必填|说明|
|---|---|---|---|
|scenario|string|是|业务场景，如 校园（与 VALID_SCENARIOS 白名单一致）|
|start_time|string|是|预测起始时间，格式 yyyy-MM-dd HH:mm:ss|
|end_time|string|是|预测结束时间，格式 yyyy-MM-dd HH:mm:ss|
|target_type|string|是|预测对象类型：ap / ue|
|target_id|string|否|指定单个对象 ID（如 AP-01 / UE-01）；不传返回全部对象|
|metric|string|是|预测指标：rsrp / sinr / throughput|
|interval|string|否|预测结果聚合粒度，默认 15min（支持 5min / 15min / 30min / 60min）|

### 响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "target_type": "ap",
    "target_id": "AP-01",
    "metric": "rsrp",
    "model": "placeholder",
    "predict_list": [
      {
        "time": "2026-01-04 00:00:00",
        "position": "AP-01",
        "predict_value": -88.5,
        "confidence_min": -92.1,
        "confidence_max": -85.2,
        "status": "normal"
      }
    ],
    "total": 96
  }
}
```

说明：占位实现阶段 `predict_list` 为空数组 `[]`、`total` 为 0、`model` 固定为 `"placeholder"`；字段结构保持契约不变，前端可先行对接联调。

### 字段说明

|字段|类型|说明|
|---|---|---|
|target_type / target_id|string|预测对象类型与标识，与请求参数一致|
|metric|string|本次预测指标|
|model|string|预测模型标识：占位阶段为 placeholder，接入 Prophet 后为 prophet、LSTM 后为 lstm|
|predict_list|array|预测结果列表，每项含 time / position / predict_value / confidence_min / confidence_max / status|
|predict_value|float|预测数值，单位同原指标（rsrp dBm、sinr dB、throughput Mbps）|
|confidence_min / confidence_max|float|置信区间上下限，与预测值同单位|
|status|string|状态标注：normal（正常）/ warning（预警）/ abnormal（异常），按预测值阈值判定|
|total|int|本次返回的预测点数量|

错误码：复用全局错误码体系——参数缺失 40001、格式非法 40002、范围越界 40003、服务异常 50001。

## 接口 9：拓扑增强数据（拓扑增强接口契约 v1）

GET /api/network/topology/enhanced?scenario=校园&time=2026-01-01 10:00:00

功能：返回指定场景、时刻下的网络拓扑增强数据。在基础拓扑（nodes + links）之上，扩展 AP/UE 属性、链路多指标与整体统计，供前端拓扑增强视图与态势分析使用。

### 请求参数

|参数|类型|必填|说明|
|---|---|---|---|
|scenario|string|是|业务场景，如 校园|
|time|string|否|指定时刻，格式 yyyy-MM-dd HH:mm:ss；不传默认取数据集最新时刻|
|include_metrics|boolean|否|是否附加链路指标，默认 true|

### 响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "timestamp": "2026-01-01 10:00:00",
    "nodes": [
      {
        "id": "AP-01", "type": "ap", "x": 120.0, "y": 220.0,
        "properties": {"rsrp_avg": -92.5, "prb_usage": 62.3, "active_users": 11}
      },
      {
        "id": "UE-01", "type": "ue", "x": 94.8, "y": 192.62,
        "properties": {"rsrp": -90.1, "sinr": 8.2, "throughput": 54.7}
      }
    ],
    "links": [
      {
        "source": "AP-01", "target": "UE-01",
        "metrics": {"rsrp": -90.1, "sinr": 8.2, "throughput": 54.7, "latency": 18.5, "packet_loss": 1.2}
      }
    ],
    "stats": {"ap_count": 3, "ue_count": 3, "link_count": 3, "avg_rsrp": -91.2, "avg_sinr": 10.3}
  }
}
```

### 字段说明

|字段|类型|说明|
|---|---|---|
|timestamp|string|本次拓扑对应的时刻|
|nodes|array|节点列表，type 区分 ap / ue；x、y 为坐标（米）；properties 为扩展属性|
|nodes[].properties|object|AP：rsrp_avg（平均信号强度）/ prb_usage（资源占用）/ active_users（活跃用户数）；UE：rsrp / sinr / throughput 当前指标|
|links|array|AP-UE 连接链路；metrics 含 rsrp / sinr / throughput / latency / packet_loss 全量核心指标|
|stats|object|整体统计：节点数、链路数、平均 RSRP / SINR，供态势概览|

错误码：复用全局错误码体系——参数缺失 40001、格式非法 40002、范围越界 40003、服务异常 50001。

> 契约状态说明：接口 8、接口 9 契约 v1 已冻结，后续模型接入（Prophet/LSTM）与前端联调均以本契约为准；字段变更需走契约评审。

## 接口 10：区域信号/频谱态势预测（Prophet 时序模型）

POST /api/analyze/forecast

功能：对每个 UE × 指标（rsrp/sinr/throughput）做 1 小时桶聚合，前 80% 训练 Prophet 模型、后 20% 测试评估（输出 predicted 与 MAPE），并在测试段之后延伸 24 小时未来预测（含置信区间 lower/upper）。与接口 8（/api/predict/result，契约 v1 占位）的区别：本接口为**已接入真实 Prophet 模型的预测数据源**，接口 8 是前端预测结果查询契约的占位实现，模型就绪后可按契约替换。

### 请求

```json
{
  "scenario": "校园",
  "window_start": "2026-01-01 00:00:00",
  "window_end": "2026-01-31 23:59:59"
}
```

|参数|类型|必填|说明|
|---|---|---|---|
|scenario|string|是|业务场景，如 校园（与 VALID_SCENARIOS 白名单一致）|
|window_start|string|是|分析窗口起始，格式 yyyy-MM-dd HH:mm:ss|
|window_end|string|是|分析窗口结束，格式 yyyy-MM-dd HH:mm:ss|

### 响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "scenario": "校园",
    "window_start": "2026-01-01 00:00:00",
    "window_end": "2026-01-31 23:59:59",
    "method": "prophet",
    "bin_size_min": 60,
    "metrics": ["rsrp", "sinr", "throughput"],
    "ues": ["UE-01", "UE-02", "UE-03"],
    "series": {
      "UE-01": {
        "rsrp": {
          "true_mean": -92.43,
          "pred_mean": -91.92,
          "mape": 0.55,
          "bins": ["2026-01-01 00:00", "...", "2026-01-30 23:00"],
          "true": [-92.1, "...", -93.0],
          "predicted": [-91.8, "...", -92.2],
          "forecast_bins": ["2026-01-31 00:00", "...", "2026-01-31 23:00"],
          "forecast": [-91.6, "...", -92.4],
          "lower": [-95.6, "...", -96.1],
          "upper": [-84.4, "...", -85.2]
        }
      }
    }
  }
}
```

### 字段说明

|字段|类型|说明|
|---|---|---|
|method|string|预测模型：prophet；Prophet 不可用时自动降级为 moving_average（接口不崩）|
|bin_size_min|int|聚合桶粒度，固定 60（1 小时）|
|metrics / ues|array|本次预测的指标与 UE 列表|
|series[ue][metric]|object|单个 UE × 指标的预测结果|
|bins / true|array|全量 1 小时桶实测序列（前端对比图横轴与实测线）|
|predicted|array|测试段（后 20%）预测值，24 点，与真实值对比用|
|true_mean / pred_mean / mape|number|测试段实测均值 / 预测均值 / 平均绝对百分比误差（%）|
|forecast_bins / forecast|array|未来 24 小时预测的时间轴与预测值|
|lower / upper|array|未来 24 小时置信区间下 / 上限（与 forecast 等长）|

### 备注

- 训练/测试切分固定 80/20；未来延伸固定 24 小时；序列不足 24 个点或 Prophet 拟合失败时自动降级 moving_average
- 数据源为 30 天仿真数据（`data/network_data_30d(1).csv`，main.py 默认读取；3d 版备份为 `data/network_data_3d_bak.csv`）
- 30d 数据第 4 天起每 2 天注入一组故障，anomaly 演示窗口请选择 1 月 4 日之后以观察到异常样本
- 错误码：复用全局错误码体系——参数缺失 40001、格式非法 40002、范围越界 40003、服务异常 50001