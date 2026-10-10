import type {
  DashboardData,
  MetricRecord,
  QueryRequest,
  QueryResponse,
} from "../types/network";

// 固定的仿真展示样例，不是实时采集，也不是传播模型计算结果。
const TIMES = [
  "14:00",
  "14:02",
  "14:04",
  "14:06",
  "14:08",
  "14:10",
].map((time) => `2026-10-03T${time}:00+08:00`);

const UE2_RATE = [35, 33, 26, 19, 13, 8];
const UE2_SINR = [18, 16, 13, 9, 7, 5];

export function createMockDashboard(): DashboardData {
  const metrics: MetricRecord[] = [];

  TIMES.forEach((timestamp, index) => {
    ["UE1", "UE2", "UE3", "UE4"].forEach((ueId, user) => {
      const weak = ueId === "UE2";

      metrics.push({
        ueId,
        timestamp,
        rssiDbm: weak ? -74 - index * 3 : -60 - user * 4,
        sinrDb: weak ? UE2_SINR[index] : 24 - user * 2,
        throughputMbps: weak ? UE2_RATE[index] : 45 - user * 5,
        latencyMs: weak ? 18 + index * 8 : 12 + user * 3,
        packetLossPct: weak ? 0.5 + index * 0.9 : 0.2 + user * 0.1,
        retransmissions: weak ? 2 + index * 4 : 1 + user,
        demandMbps: weak ? 20 : 40 - user * 5,
        resourceUtilizationPct: weak ? 68 + index * 5 : 48 + user * 6,
      });
    });
  });

  return {
    source: "simulation",
    generatedAt: TIMES.at(-1)!,
    sampleIntervalSeconds: 120,
    area: {
      width: 800,
      height: 600,
    },
    nodes: [
      { id: "AP1", type: "ap", x: 120, y: 180 },
      { id: "AP2", type: "ap", x: 640, y: 180 },
      { id: "AP3", type: "ap", x: 420, y: 450 },
      { id: "UE1", type: "ue", x: 200, y: 200 },
      { id: "UE2", type: "ue", x: 620, y: 420 },
      { id: "UE3", type: "ue", x: 380, y: 380 },
      { id: "UE4", type: "ue", x: 700, y: 220 },
    ],
    links: [
      { id: "AP1-UE1", source: "AP1", target: "UE1" },
      { id: "AP2-UE2", source: "AP2", target: "UE2" },
      { id: "AP3-UE3", source: "AP3", target: "UE3" },
      { id: "AP2-UE4", source: "AP2", target: "UE4" },
    ],
    metrics,
    radioMap: {
      kind: "sampled",
      metric: "rssiDbm",
      timestamp: TIMES.at(-1)!,
      points: [
        { x: 200, y: 200, value: -60 },
        { x: 620, y: 420, value: -89 },
        { x: 380, y: 380, value: -68 },
        { x: 700, y: 220, value: -72 },
        { x: 100, y: 100, value: -66 },
        { x: 400, y: 100, value: -76 },
        { x: 100, y: 500, value: -82 },
        { x: 700, y: 500, value: -91 },
      ],
    },
  };
}

export function createMockQuery(
  request: QueryRequest,
): QueryResponse {
  const data = createMockDashboard();

  // 问题中明确指定 UE 时，优先使用问题中的对象。
  const match = request.message.match(/UE\s*(\d+)/i);
  const targetId = match
    ? `UE${match[1]}`
    : request.selectedUeId || "UE2";

  const exists = data.nodes.some(
    (node) => node.type === "ue" && node.id === targetId,
  );

  if (!exists) {
    throw new Error(
      `当前样例没有 ${targetId}，请选择已有 UE。`,
    );
  }

  const metrics = data.metrics.filter(
    (record) => record.ueId === targetId,
  );
  const last = metrics.at(-1)!;

  const wantsAnalysis =
    /原因|为什么|分析|why|cause/i.test(request.message);

  const wantsTopology =
    /连接|关联|拓扑|服务|topology/i.test(request.message);

  const response: QueryResponse = {
    mode: "demo",
    targetId,
    metrics,
    analysis: null,
    view: wantsTopology ? "topology" : "metrics",
    message:
      `${targetId} 样例：RSSI ${last.rssiDbm} dBm，` +
      `SINR ${last.sinrDb} dB，` +
      `吞吐量 ${last.throughputMbps} Mbps。`,
  };

  if (wantsAnalysis && targetId === "UE2") {
    response.view = "analysis";
    response.message =
      "以下是预设的 UE2 展示案例，供前端联调，不是自动诊断。";

    response.analysis = {
      targetId,
      isExample: true,
      observation:
        "UE2 吞吐量由 35 降至 8 Mbps，末帧低于 20 Mbps 业务需求。",
      causes: [
        {
          id: "signal-quality",
          title: "候选原因：接收质量下降",
          support: [
            "RSSI 从 -74 降至 -89 dBm。",
            "SINR 从 18 降至 5 dB，同时重传增多。",
          ],
          against: [
            "资源占用也在上升，接收质量下降不能单独解释全部变化。",
          ],
          missing: [
            "缺少信道、噪声和独立干扰测量，不能区分遮挡与干扰。",
          ],
          nextAction:
            "检查同一区域其他终端与独立干扰测量。",
        },
        {
          id: "resource-pressure",
          title: "候选原因：资源竞争加重",
          support: [
            "资源占用率由 68% 升至 93%，时延由 18 升至 58 ms。",
          ],
          against: [
            "UE1 吞吐量仍为 45 Mbps，不支持所有终端同时拥塞的判断。",
          ],
          missing: [
            "缺少 AP 侧队列、活跃用户数与调度数据，不能确认拥塞。",
          ],
          nextAction:
            "补查服务 AP 的负载、队列和其他用户指标。",
        },
      ],
    };
  } else if (wantsAnalysis) {
    response.message +=
      " 当前只预设 UE2 原因案例；其他对象待接入后端研判。";
  }

  return response;
}