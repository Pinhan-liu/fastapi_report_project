import { useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
import type { Diagnosis, QueryScope } from "../../types/backend";
import { scopeLabel } from "../../services/backend";
import type { DiagnosisPreparation } from "../management/preparePlan";
import EvidencePanel from "./EvidencePanel";
import "./DiagnosisModule.css";
import "./DiagnosisCompact.css";

export type DiagnosisHandle = {
  showChat: () => void;
};

type Source = "current" | "chat";

export default function DiagnosisModule({
  result,
  pending,
  error,
  chatDiagnosis,
  scope,
  onAnalyze,
  onPrepare,
  ref,
}: {
  ref?: Ref<DiagnosisHandle>;
  result: Diagnosis | null;
  pending: boolean;
  error: string;
  chatDiagnosis: Diagnosis | null;
  scope: QueryScope;
  onAnalyze: () => void;
  onPrepare?: (input: DiagnosisPreparation) => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const [preferredSource, setPreferredSource] =
    useState<Source>("current");

  useImperativeHandle(
    ref,
    () => ({
      showChat() {
        if (!chatDiagnosis) return;

        setPreferredSource("chat");

        const panel = panelRef.current;
        if (panel) {
          panel
            .querySelector<HTMLElement>("header")
            ?.focus({ preventScroll: true });

          panel.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      },
    }),
    [chatDiagnosis],
  );

  const hasCurrent = Boolean(result || pending || error);

  const source: Source =
    preferredSource === "chat" && chatDiagnosis
      ? "chat"
      : !hasCurrent && chatDiagnosis
        ? "chat"
        : "current";

  const active = source === "chat" ? chatDiagnosis : result;

  const status = pending
    ? "分析中"
    : error
      ? "分析失败"
      : result?.state === "anomaly"
        ? "发现异常"
        : result?.state === "normal"
          ? "未发现明显异常"
          : result?.state === "empty"
            ? "无可分析数据"
            : "尚未分析";

  const tone = pending
    ? "info"
    : error
      ? "error"
      : result?.state === "anomaly"
        ? "warning"
        : result?.state === "normal"
          ? "success"
          : "neutral";

  const summaryText =
    active?.state === "anomaly"
      ? `${active.anomalyType || "发现异常"} · ${
          active.affectedAps.join("、") || "AP 未提供"
        } · ${active.candidates.length} 个候选原因`
      : active?.state === "normal"
        ? "未发现明显异常"
        : active?.state === "empty"
          ? "此范围无可分析数据"
          : "查看结论、指标证据和候选原因";

  const differentScope =
    active &&
    (active.scope.scenario !== scope.scenario ||
      active.scope.start !== scope.start ||
      active.scope.end !== scope.end);

  return (
    <section
      ref={panelRef}
      className="ain-diagnosis-module ain-diagnosis-v2 ain-feature-module"
      id="ain-diagnosis-module"
      aria-labelledby="ain-diagnosis-title"
    >
      <header
        tabIndex={-1}
        className="ain-diagnosis-summary ain-feature-heading"
        aria-label="查看结论、指标证据和候选原因"
      >
        <span className="ain-module-number" aria-hidden="true">
          03
        </span>

        <div className="ain-module-title">
          <h2 className="ain-feature-title" id="ain-diagnosis-title">故障研判与证据</h2>
          <p>
            {active
              ? `${source === "chat" ? "对话研判" : "时段研判"}：`
              : ""}
            {summaryText}
          </p>
        </div>

        <span className="ain-module-state" data-tone={tone}>
          当前时段：{status}
          {chatDiagnosis ? " · 对话研判已返回" : ""}
        </span>

      </header>

      <div className="ain-diagnosis-content">
        <div className="ain-diagnosis-toolbar-v2">
          <div
            className="ain-diagnosis-sources"
            role="group"
            aria-label="选择研判结果来源"
          >
            <button
              type="button"
              className={source === "current" ? "is-active" : ""}
              aria-pressed={source === "current"}
              onClick={() => setPreferredSource("current")}
              disabled={!hasCurrent && Boolean(chatDiagnosis)}
            >
              当前时间段分析
            </button>

            <button
              type="button"
              className={source === "chat" ? "is-active" : ""}
              aria-pressed={source === "chat"}
              onClick={() => setPreferredSource("chat")}
              disabled={!chatDiagnosis}
            >
              AI 对话研判
            </button>
          </div>

          <button
            type="button"
            className="ain-button ain-primary"
            disabled={pending}
            title={`按 AP 分析：${scopeLabel(scope)}`}
            onClick={() => {
              setPreferredSource("current");
              onAnalyze();
            }}
          >
            {pending ? "正在分析…" : "分析当前时间段"}
          </button>
        </div>

        {(!active || differentScope) && (
          <p className="ain-scope-context">
            当前数据范围：{scopeLabel(scope)}
            {differentScope
              ? "；下方对话结果使用不同范围。"
              : " · 按 AP 分析"}
          </p>
        )}

        <EvidencePanel
          key={source}
          result={active}
          pending={source === "current" && pending}
          error={source === "current" ? error : ""}
          title={
            source === "chat"
              ? "AI 对话研判结果"
              : "当前时间段研判结果"
          }
          onPrepare={
            onPrepare
              ? (selectedResult, candidate) =>
                  onPrepare({
                    source,
                    result: selectedResult,
                    candidate,
                  })
              : undefined
          }
        />
      </div>
    </section>
  );
}