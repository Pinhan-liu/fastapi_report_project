import { useState } from "react";
import type useNetworkQuery from "../hooks/useNetworkQuery";
import type { QueryScope } from "../types/backend";
import { scopeLabel } from "../services/backend";
import "./QueryPanel.css";

const INTENT_LABELS: Record<string, string> = {
  fault_diagnosis: "故障研判",
  get_heatmap: "热力图",
  get_topology: "连接查询",
  query_kpi: "指标查询",
};


export default function QueryPanel({
  query,
  scenario,
  window: scopeWindow,
  disabled,
  onViewDiagnosis,
}: {
  query: ReturnType<typeof useNetworkQuery>;
  scenario: string;
  window?: QueryScope;
  disabled: boolean;
  onViewDiagnosis?: () => void;
}) {
  const [draft, setDraft] = useState("");

  const busy = disabled || query.pending;
  const result = query.result;

  const scopeText = scopeWindow
    ? scopeLabel(scopeWindow)
    : `${scenario} · 后端默认范围`;

  const mismatch =
    result &&
    scopeWindow &&
    (result.scope.scenario !== scopeWindow.scenario ||
      result.scope.start !== scopeWindow.start ||
      result.scope.end !== scopeWindow.end);

  const status = query.pending
    ? "查询中"
    : query.error
      ? "请求失败"
      : result
        ? "已返回"
        : "等待提问";

  function send() {
    if (!busy && draft.trim()) {
      void query.submit(draft, scenario, scopeWindow);
    }
  }

  return (
    <section
      className="ain-ai-panel ain-ai-v2 ain-feature-module"
      id="ain-ai-module"
      aria-labelledby="ain-ai-title"
    >
      <div className="ain-ai-heading ain-feature-heading">
        <div>
          <span className="ain-ai-symbol" aria-hidden="true">
            AI
          </span>
          <h2 className="ain-feature-title" id="ain-ai-title">AI 对话交互</h2>
          <span className="ain-ai-badge">大模型交互 · 核心入口</span>
        </div>

        {(!result || mismatch) && (
          <span className="ain-ai-scope">
            查询范围：{scopeText}
          </span>
        )}
      </div>

      <div className="ain-ai-grid">
        <form
          className="ain-query-form"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <label className="ain-input-label" htmlFor="ain-question">
            描述你想查询或分析的问题
          </label>

          <textarea
            id="ain-question"
            rows={3}
            maxLength={500}
            value={draft}
            disabled={busy}
            placeholder="例如：分析校园 AP-02 的弱覆盖原因，给出判断依据和验证建议。"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                (event.ctrlKey || event.metaKey) &&
                event.key === "Enter" &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                send();
              }
            }}
          />

          <div className="ain-query-input-meta">
            <span>Ctrl / Cmd + Enter 发送</span>
            <span>{draft.length}/500</span>
          </div>

          <div className="ain-query-send-row">
            <div className="ain-query-shortcuts">
              {[
                ["指标概览", `${scenario}的 KPI 数据`],
                ["分析原因", `${scenario}有没有异常，分析问题原因`],
                ["生成热力图", `${scenario}的信号热力图`],
                ["查看连接", `${scenario}的拓扑连接关系`],
              ].map(([label, text]) => (
                <button
                  type="button"
                  key={label}
                  className="ain-button"
                  disabled={busy}
                  onClick={() => {
                    setDraft(text);
                    void query.submit(text, scenario, scopeWindow);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="submit"
              className="ain-button ain-primary"
              disabled={busy || !draft.trim()}
            >
              {query.pending ? "正在查询…" : "发送查询"}
            </button>
          </div>

          {disabled && !query.pending && (
            <p className="ain-query-tip">
              请先在下方加载数据范围。
            </p>
          )}
        </form>

        <section
          className="ain-ai-answer-column"
          aria-live="polite"
          aria-busy={query.pending}
        >
          <div className="ain-ai-answer-heading">
            <h3>助手分析结果</h3>
            <span
              data-tone={
                query.pending
                  ? "info"
                  : query.error
                    ? "error"
                    : "neutral"
              }
            >
              {status}
            </span>
          </div>

          {query.pending && (
            <p
              className="ain-ai-message ain-ai-empty"
              role="status"
            >
              等待后端返回数据与分析结果…
            </p>
          )}

          {query.error && (
            <p className="ain-query-error" role="alert">
              {query.error}
            </p>
          )}

          {!query.pending && !query.error && !result && (
            <p className="ain-ai-message ain-ai-empty">
              输入网络问题，或选择左侧的快捷查询。
            </p>
          )}

          {result && !query.pending && !query.error && (
            <>
              <p className="ain-ai-message">{result.reply}</p>

              <div className="ain-ai-answer-footer">
                <span className="ain-ai-intent">
                  {INTENT_LABELS[result.intent] ||
                    result.intent ||
                    "工具返回"}
                </span>

                <div className="ain-ai-result-actions">
                  {result.diagnosis && onViewDiagnosis && (
                    <button
                      type="button"
                      className="ain-button"
                      onClick={onViewDiagnosis}
                    >
                      查看研判证据 ↓
                    </button>
                  )}

                  {result.chart && (
                    <a
                      className="ain-button"
                      href="#ain-tool-result"
                    >
                      查看工具图表 ↓
                    </a>
                  )}
                </div>
              </div>

              <p className="ain-ai-returned-scope">
                返回范围：{scopeLabel(result.scope)}
              </p>

              {mismatch && (
                <p className="ain-query-scope-warning">
                  返回范围与当前数据不同，请核对范围后使用研判结果。
                </p>
              )}
            </>
          )}
        </section>
      </div>

      <div className="ain-query-footer">
        <details className="ain-query-history-details">
          <summary>
            本次查询记录
            <span>{query.history.length}/6</span>
            <span className="ain-history-open">展开</span>
            <span className="ain-history-close">收起</span>
          </summary>

          <p className="ain-query-history-note">
            最近 6 次 · 刷新后清空
          </p>

          <div className="ain-query-history">
            {!query.history.length && (
              <p className="ain-query-empty">暂无查询记录</p>
            )}

            {query.history.map((entry) => (
              <article
                key={entry.id}
                className={`ain-query-record${
                  entry.failed ? " is-error" : ""
                }`}
              >
                <div className="ain-query-record-meta">
                  <span>
                    {entry.failed ? "请求失败" : "查询结果"}
                  </span>
                  <time>
                    {new Date(entry.createdAt).toLocaleTimeString(
                      "zh-CN",
                      { hour12: false },
                    )}
                  </time>
                </div>

                <p className="ain-query-question">
                  {entry.question}
                </p>
                <p className="ain-query-answer">
                  {entry.answer}
                </p>
                <p className="ain-query-tip">
                  {entry.scope}（北京时间）
                </p>
              </article>
            ))}
          </div>
        </details>

        <button
          type="button"
          className="ain-query-clear"
          disabled={query.pending || !query.history.length}
          onClick={query.clearHistory}
        >
          清空记录
        </button>
      </div>
    </section>
  );
}