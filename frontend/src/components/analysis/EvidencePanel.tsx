import type { Candidate, Diagnosis } from "../../types/backend";
import { scopeLabel } from "../../services/backend";
import { displayMetric } from "../../services/metrics";
import "./EvidencePanel.css";

function CauseCard({ candidate }: { candidate: Candidate }) {
  return <article className="ain-cause-card">
    <h3>{candidate.rank}. {candidate.cause}</h3>
    <p className="ain-analysis-note">规则评分：{displayMetric(candidate.score * 100)} / 100</p>
    {[
      { title: "支持证据", values: candidate.support, className: "ain-support" },
      { title: "反证与限制", values: candidate.against, className: "ain-against" },
      { title: "待验证项", values: candidate.checks, className: "ain-missing" },
    ].map(group => <div key={group.title} className={`ain-evidence-group ${group.className}`}>
      <h4>{group.title}</h4>{group.values.length ? <ul>{group.values.map((value, i) => <li key={i}>{value}</li>)}</ul> : <p>后端未提供</p>}
    </div>)}
  </article>;
}
export default function EvidencePanel({ result, pending, error, title = "故障研判与证据" }: {
  result: Diagnosis | null; pending: boolean; error: string; title?: string;
}) {
  return <section className="ain-evidence-slot" aria-live="polite">
    <div className="ain-evidence-heading"><h2>{title}</h2><span className="ain-result-badge">后端规则研判</span></div>
    {pending && <p className="ain-analysis-note">正在分析场景内各 AP…</p>}
    {error && <p className="ain-query-error" role="alert">{error}</p>}
    {!result && !pending && !error && <p className="ain-analysis-note">点击“分析当前时间段”，查看覆盖故障、网络拥塞或边缘弱用户的候选原因。</p>}
    {result && <>
      <p className="ain-analysis-note">{scopeLabel(result.scope)} · 按 AP 分析，未按当前 UE 单独筛选。</p>
      <p className="ain-analysis-observation" data-diagnosis-type={result.anomalyType}>
        {result.state === "empty" ? "此范围无可分析数据" : result.state === "normal" ? "此范围未检测到明显异常" : `${result.anomalyType} · ${result.level} · ${result.affectedAps.join("、")}`}
      </p>
      <p className="ain-analysis-observation">{result.cause}</p>
      {result.state === "anomaly" && <p className="ain-analysis-note">规则评分 {displayMetric(result.score * 100)}/100；这是候选解释，尚未确认物理根因。</p>}
      {result.evidence.length > 0 && <div className="ain-threshold-list">{result.evidence.map((e, i) => <span key={i}>{e.metric}：{displayMetric(e.value)} · 阈值 {displayMetric(e.threshold)} · {e.status}</span>)}</div>}
      <div className="ain-cause-grid">{result.candidates.map((c, i) => <CauseCard key={i} candidate={c} />)}</div>
      {result.suggestion && <div className="ain-next-action"><h3>后续检查建议</h3><p>{result.suggestion}</p></div>}
      {result.comparison.length > 0 && <div className="ain-table-scroll"><table className="ain-comparison"><caption>各 AP 在此范围的均值与判定</caption><thead><tr><th>AP</th><th>判定</th><th>RSRP / dBm</th><th>SINR / dB</th><th>吞吐 / Mbps</th><th>PRB / %</th></tr></thead><tbody>{result.comparison.map(a => <tr key={a.id}><td>{a.id}</td><td>{a.type} · {a.level}</td><td>{displayMetric(a.rsrp)}</td><td>{displayMetric(a.sinr)}</td><td>{displayMetric(a.throughput)}</td><td>{displayMetric(a.prb)}</td></tr>)}</tbody></table></div>}
      {result.apCandidates.length > 0 && <details className="ain-more-evidence"><summary>其他 AP 的候选原因（{result.apCandidates.length} 组）</summary>{result.apCandidates.map((a, i) => <div key={i}><h3>{a.id} / 返回分组 {i + 1}</h3><div className="ain-cause-grid">{a.candidates.map((c, j) => <CauseCard key={j} candidate={c} />)}</div></div>)}</details>}
      {result.alarms.length > 0 && <details className="ain-more-evidence"><summary>告警历史（后端返回 {result.alarms.length} 条，最多 50 条）</summary><ul>{result.alarms.map((a, i) => <li key={i}>{a.time} · {a.ap} · {a.type} · {a.level}<p>{a.cause}</p></li>)}</ul></details>}
    </>}
  </section>;
}
