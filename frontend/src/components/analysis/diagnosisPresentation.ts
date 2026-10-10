import type { Candidate, Diagnosis } from "../../types/backend";
import { displayMetric } from "../../services/metrics";

const METRICS: Record<string, { label: string; unit: string }> = {
  rsrp: { label: "RSRP", unit: "dBm" },
  sinr: { label: "SINR", unit: "dB" },
  throughput: { label: "吞吐量", unit: "Mbps" },
  prb_usage: { label: "PRB 占用率", unit: "" },
  packet_loss: { label: "丢包率", unit: "" },
};

export function evidenceLabel(metric: string) {
  return METRICS[metric]?.label || metric || "未命名指标";
}

export function evidenceText(item: Diagnosis["evidence"][number]) {
  const unit = METRICS[item.metric]?.unit;
  const suffix = unit ? ` ${unit}` : "";

  return `${evidenceLabel(item.metric)} ${displayMetric(
    item.value,
  )}${suffix} · 阈值 ${displayMetric(item.threshold)}${suffix}`;
}

function sameCandidate(a: Candidate, b: Candidate) {
  const same = (x: string[], y: string[]) =>
    x.length === y.length &&
    x.every((value, index) => value === y[index]);

  return (
    a.rank === b.rank &&
    a.cause === b.cause &&
    Object.is(a.score, b.score) &&
    same(a.support, b.support) &&
    same(a.against, b.against) &&
    same(a.checks, b.checks)
  );
}

export function apCandidateGroups(result: Diagnosis) {
  const ids = [...new Set(result.affectedAps.filter(id => id.trim()))];

  const mainAp =
    result.state === "anomaly" && ids.length === 1 ? ids[0] : null;

  return result.apCandidates.map(group => {
    const remaining = group.candidates.filter(
      candidate =>
        !(
          group.id === mainAp &&
          result.candidates.some(main => sameCandidate(main, candidate))
        ),
    );

    return {
      id: group.id,
      candidates: remaining,
      shownInMain: group.candidates.length - remaining.length,
    };
  });
}