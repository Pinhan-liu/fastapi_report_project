import type { MetricRecord } from "../types/backend";

// 跨 UE 比较只使用同一采样时刻，缺失对象不补成零。
export function getLatestFrame(records: MetricRecord[]): {
  timestamp: string | null;
  metrics: MetricRecord[];
} {
  let latestTime = -Infinity;
  let timestamp: string | null = null;
  for (const record of records) {
    const time = Date.parse(record.timestamp);
    if (Number.isFinite(time) && time > latestTime) {
      latestTime = time;
      timestamp = record.timestamp;
    }
  }
  const byUE = new Map<string, MetricRecord>();
  for (const record of records) {
    if (Date.parse(record.timestamp) === latestTime)
      byUE.set(record.ueId, record);
  }
  return {
    timestamp,
    metrics: [...byUE.values()].sort((a, b) =>
      a.ueId.localeCompare(b.ueId, "en", { numeric: true }),
    ),
  };
}

// 同一对象、同一时刻重复记录保留最后一条；不改变原数组。
export function getUEHistory(
  records: MetricRecord[],
  ueId: string,
): MetricRecord[] {
  const byTime = new Map<number, MetricRecord>();
  for (const record of records) {
    const time = Date.parse(record.timestamp);
    if (record.ueId === ueId && Number.isFinite(time)) byTime.set(time, record);
  }
  return [...byTime.values()].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
}

export function displayMetric(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(Number(value.toFixed(1))) : "—";
}
