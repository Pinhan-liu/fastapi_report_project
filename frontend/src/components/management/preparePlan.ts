import type { Candidate, DashboardData, Diagnosis } from "../../types/backend";
import { scopeLabel } from "../../services/backend";
import type { DraftFields } from "./managementDraft";

export type DiagnosisPreparation = {
  source: "current" | "chat";
  result: Diagnosis;
  candidate: Candidate | null;
};
export type ManagementHandle = { prepare: (input: DiagnosisPreparation) => void };

export function preparePlanFields(
  data: DashboardData, input: DiagnosisPreparation, previous: DraftFields,
): DraftFields {
  const { result, candidate, source } = input;
  if (result.state !== "anomaly" || !result.suggestion.trim()) {
    throw new Error("此研判没有可引用的异常操作建议，请先完成研判或手动填写方案。");
  }
  if (result.scope.scenario !== data.scope.scenario || result.scope.start !== data.scope.start
    || result.scope.end !== data.scope.end) {
    throw new Error("研判范围与当前数据不同，请先加载该研判对应的范围。");
  }
  const affected = [...new Set(result.affectedAps.filter(id => id.trim()))];
  const apId = affected.length === 1 && data.nodes.some(node => node.type === "ap" && node.id === affected[0])
    ? affected[0] : "";
  const sameAp = Boolean(apId) && apId === previous.apId;
  const note = [
    `[研判依据] ${source === "chat" ? "AI 对话研判" : "当前时间段研判"}`,
    `范围：${scopeLabel(result.scope)}`,
    `异常：${result.anomalyType || "未提供类型"}`,
    candidate ? `候选原因（待验证）：${candidate.cause}` : "尚无候选原因明细。",
    candidate?.support.length ? `支持：${candidate.support.join("；")}` : "",
    candidate?.against.length ? `反证与限制：${candidate.against.join("；")}` : "",
    candidate?.checks.length ? `待验证：${candidate.checks.join("；")}` : "",
    `后端建议：${result.suggestion}`,
  ].filter(Boolean).join("\n");
  return {
    ...previous,
    name: previous.name.trim() ? previous.name : `${apId || "网络"} · ${result.anomalyType || "异常"}调整草稿`,
    apId,
    parameter: sameAp ? previous.parameter : "",
    targetValue: sameAp ? previous.targetValue : "",
    unit: sameAp ? previous.unit : "",
    note: previous.note.includes(note) ? previous.note : [previous.note.trim(), note].filter(Boolean).join("\n\n"),
  };
}
