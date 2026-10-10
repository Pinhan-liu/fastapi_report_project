// 统一数据结构。后续对接时需与团队 docs/api.md 同步。
export type DataSource = "simulation" | "csv" | "measurement";

export type MetricKey =
  | "rssiDbm"
  | "sinrDb"
  | "throughputMbps"
  | "latencyMs"
  | "packetLossPct"
  | "retransmissions"
  | "demandMbps"
  | "resourceUtilizationPct";

// 图表标题和单位统一从这里取，避免各页面写成不同口径。
export const METRIC_META: Record<
  MetricKey,
  { label: string; unit: string }
> = {
  rssiDbm: { label: "接收信号强度", unit: "dBm" },
  sinrDb: { label: "信干噪比", unit: "dB" },
  throughputMbps: { label: "吞吐量", unit: "Mbps" },
  latencyMs: { label: "时延", unit: "ms" },
  packetLossPct: { label: "丢包率", unit: "%" },
  retransmissions: { label: "重传次数", unit: "次/采样区间" },
  demandMbps: { label: "业务需求", unit: "Mbps" },
  resourceUtilizationPct: { label: "资源占用率", unit: "%" },
};

export interface NetworkNode {
  id: string;
  type: "ap" | "ue";
  x: number; // 场景平面坐标，单位 m；不是经纬度
  y: number;
}

export interface NetworkLink {
  id: string;
  source: string; // AP ID
  target: string; // UE ID
}

export type MetricRecord = Record<MetricKey, number> & {
  ueId: string;
  timestamp: string; // 带时区的 ISO 时间
};

export interface RadioMapPoint {
  x: number;
  y: number;
  value: number; // RSSI，单位 dBm
}

export interface DashboardData {
  source: DataSource;
  generatedAt: string;
  sampleIntervalSeconds: number;
  area: {
    width: number;
    height: number;
  }; // m
  nodes: NetworkNode[];
  links: NetworkLink[];
  metrics: MetricRecord[]; // 所有 UE 的历史记录
  radioMap: {
    kind: "sampled"; // 仅展示提供的采样点，不代表未测位置预测
    metric: "rssiDbm";
    timestamp: string;
    points: RadioMapPoint[];
  };
}

export interface CandidateCause {
  id: string;
  title: string;
  support: string[];
  against: string[]; // 反证或限制
  missing: string[];
  nextAction: string;
}

export interface AnalysisResult {
  targetId: string;
  observation: string;
  causes: CandidateCause[];
  isExample: boolean; // true 表示预设展示案例
}

export interface QueryRequest {
  message: string;
  selectedUeId?: string;
}

export interface QueryResponse {
  mode: "demo" | "llm" | "rule";
  view: "metrics" | "analysis" | "topology";
  message: string;
  targetId: string;
  metrics: MetricRecord[];
  analysis: AnalysisResult | null;
}