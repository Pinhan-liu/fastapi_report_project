import { useState } from "react";
import type useNetworkQuery from "../hooks/useNetworkQuery";
import type { QueryScope } from "../types/backend";
import "./QueryPanel.css";

export default function QueryPanel({ query, scenario, window: scopeWindow, disabled }: {
  query: ReturnType<typeof useNetworkQuery>; scenario: string; window?: QueryScope; disabled: boolean;
}) {
  const [draft, setDraft] = useState("");
  const busy = disabled || query.pending;
  const scopeText = scopeWindow
    ? `${scopeWindow.start} — ${scopeWindow.end}`
    : "2026-01-01—01-03（默认）";
  function send() { if (!busy && draft.trim()) void query.submit(draft, scenario, scopeWindow); }
  return <section>
    <h3>自然语言查询</h3>
    <p className="ain-query-tip">对话工具按当前展示窗口查询（{scopeText}）。结果中的场景和时间以工具返回为准；当前版本不支持单独诊断一个 UE。</p>
    <div className="ain-query-shortcuts">
      {[
        ["指标概况", `${scenario}的 KPI 数据`],
        ["分析原因", `${scenario}有没有异常，分析问题原因`],
        ["生成热力图", `${scenario}的信号热力图`],
        ["查看连接", `${scenario}的拓扑连接关系`],
      ].map(([label, text]) => <button key={label} className="ain-button" disabled={busy} onClick={() => { setDraft(text); void query.submit(text, scenario, scopeWindow); }}>{label}</button>)}
    </div>
    <form className="ain-query-form" onSubmit={event => { event.preventDefault(); send(); }}>
      <label className="ain-input-label" htmlFor="ain-question">输入问题</label>
      <textarea id="ain-question" rows={4} maxLength={500} value={draft} disabled={busy}
        placeholder="例如：校园的信号热力图"
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); send(); }
        }} />
      <div className="ain-query-input-meta"><span>Ctrl / Cmd + Enter</span><span>{draft.length}/500</span></div>
      <button className="ain-button ain-primary" disabled={busy || !draft.trim()}>{query.pending ? "正在查询…" : "发送查询"}</button>
    </form>
    {query.error && <p className="ain-query-error" role="alert">{query.error}</p>}
    <div className="ain-query-history-heading"><h3>本次查询记录</h3><button className="ain-query-clear" disabled={query.pending || !query.history.length} onClick={query.clearHistory}>清空查询记录</button></div>
    <p className="ain-query-history-note">保留最近六次；刷新页面后清空。</p>
    <div className="ain-query-history" aria-live="polite">
      {!query.history.length && <p className="ain-query-empty">暂无查询记录</p>}
      {query.history.map(entry => <article key={entry.id} className={`ain-query-record${entry.failed ? " is-error" : ""}`}>
        <div className="ain-query-record-meta"><span>{entry.failed ? "请求失败" : "后端工具结果"}</span><time>{new Date(entry.createdAt).toLocaleTimeString("zh-CN", { hour12: false })}</time></div>
        <p className="ain-query-question">{entry.question}</p><p className="ain-query-answer">{entry.answer}</p>
        <p className="ain-query-history-note">{entry.scope}（北京时间）</p>
      </article>)}
    </div>
  </section>;
}
