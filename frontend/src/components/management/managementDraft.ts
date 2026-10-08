import { METRIC_META } from "../../types/backend";
import type {
  DashboardData,
  Diagnosis,
  MetricKey,
  QueryScope,
} from "../../types/backend";

export type SuggestionSource = "manual" | "current" | "chat";

export interface DraftFields {
  name: string;
  apId: string;
  parameter: string;
  targetValue: string;
  unit: string;
  note: string;
}

export const EMPTY_DRAFT: DraftFields = {
  name: "",
  apId: "",
  parameter: "",
  targetValue: "",
  unit: "",
  note: "",
};

export interface BaselineSnapshot {
  scope: QueryScope;
  generatedAt: string;
  apId: string;
  sampleCount: number;
  ueIds: string[];
  metrics: Record<MetricKey, { mean: number | null; count: number }>;
}

export interface PlanDraft {
  schema: "AI-NetTune/local-plan-draft/v1";
  status: "draft_not_executed";
  createdAt: string;
  fields: DraftFields;
  suggestion: {
    source: SuggestionSource;
    scope: QueryScope | null;
    text: string;
  };
  baseline: BaselineSnapshot;
  parameterValidation: "not_checked_by_backend";
  simulation: null;
}

function sameScope(a: QueryScope, b: QueryScope) {
  return (
    a.scenario === b.scenario &&
    a.start === b.start &&
    a.end === b.end
  );
}

function normalize(fields: DraftFields): DraftFields {
  return {
    name: fields.name.trim(),
    apId: fields.apId.trim(),
    parameter: fields.parameter.trim(),
    targetValue: fields.targetValue.trim(),
    unit: fields.unit.trim(),
    note: fields.note.trim(),
  };
}

export function buildBaseline(
  data: DashboardData,
  apId: string,
): BaselineSnapshot | null {
  if (!data.nodes.some(node => node.type === "ap" && node.id === apId)) {
    return null;
  }

  const rows = data.metrics.filter(row => row.apId === apId);

  if (!rows.length) {
    return null;
  }

  const metrics = {} as BaselineSnapshot["metrics"];

  for (const key of Object.keys(METRIC_META) as MetricKey[]) {
    const values = rows.map(row => row[key]).filter(Number.isFinite);

    metrics[key] = {
      mean: values.length
        ? values.reduce((sum, value) => sum + value / values.length, 0)
        : null,
      count: values.length,
    };
  }

  return {
    scope: { ...data.scope },
    generatedAt: data.generatedAt,
    apId,
    sampleCount: rows.length,
    ueIds: [...new Set(rows.map(row => row.ueId))],
    metrics,
  };
}

export function createPlanDraft(
  data: DashboardData,
  fields: DraftFields,
  source: SuggestionSource,
  diagnosis: Diagnosis | null,
  createdAt: string,
): PlanDraft {
  const clean = normalize(fields);

  if (!clean.name || !clean.apId || !clean.parameter || !clean.targetValue) {
    throw new Error("请填写方案名称、目标 AP、调整参数和目标值。");
  }

  const baseline = buildBaseline(data, clean.apId);

  if (!baseline) {
    throw new Error(
      "目标 AP 无有效采样记录，请选择当前数据中有记录的 AP。",
    );
  }

  if (source !== "manual") {
    if (!diagnosis?.suggestion.trim()) {
      throw new Error("所选来源暂无操作建议，请重新选择。");
    }

    if (!sameScope(data.scope, diagnosis.scope)) {
      throw new Error(
        "建议范围与已加载数据不同，请加载建议对应范围，或选择手动方案。",
      );
    }
  }

  return {
    schema: "AI-NetTune/local-plan-draft/v1",
    status: "draft_not_executed",
    createdAt,
    fields: clean,
    suggestion: {
      source,
      scope: source === "manual" ? null : { ...diagnosis!.scope },
      text: source === "manual" ? "" : diagnosis!.suggestion,
    },
    baseline,
    parameterValidation: "not_checked_by_backend",
    simulation: null,
  };
}

export function isPlanCurrent(
  plan: PlanDraft,
  data: DashboardData,
  fields: DraftFields,
  source: SuggestionSource,
  diagnosis: Diagnosis | null,
): boolean {
  if (
    !sameScope(plan.baseline.scope, data.scope) ||
    plan.baseline.generatedAt !== data.generatedAt
  ) {
    return false;
  }

  if (JSON.stringify(plan.fields) !== JSON.stringify(normalize(fields))) {
    return false;
  }

  if (plan.suggestion.source !== source) {
    return false;
  }

  if (source === "manual") {
    return true;
  }

  return Boolean(
    diagnosis?.suggestion.trim() &&
      plan.suggestion.scope &&
      sameScope(data.scope, diagnosis.scope) &&
      sameScope(plan.suggestion.scope, diagnosis.scope) &&
      plan.suggestion.text === diagnosis.suggestion,
  );
}