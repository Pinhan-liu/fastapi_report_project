import { useState } from "react";
import type { Candidate, Diagnosis } from "../../types/backend";
import { scopeLabel } from "../../services/backend";
import { displayMetric } from "../../services/metrics";
import {
  apCandidateGroups,
  evidenceLabel,
  evidenceText,
} from "./diagnosisPresentation";
import "./EvidencePanel.css";

function ruleScore(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 1
    ? `${displayMetric(value * 100)} / 100`
    : "未提供有效评分";
}

function evidenceStatus(status: string) {
  const value = status.trim().toLowerCase();

  if (["异常", "abnormal", "anomaly"].includes(value)) {
    return "warning";
  }

  if (["正常", "normal"].includes(value)) {
    return "success";
  }

  return "neutral";
}

function CauseCard({ candidate }: { candidate: Candidate }) {
  return (
    <article className="ain-cause-card">
      <div className="ain-cause-card-heading">
        <h3>
          {candidate.rank}. {candidate.cause || "未提供原因名称"}
        </h3>

        <span title="规则评分不代表概率">
          规则评分：{ruleScore(candidate.score)}
        </span>
      </div>

      <div className="ain-proof-grid">
        {[
          {
            title: "支持证据",
            values: candidate.support,
            className: "ain-support",
          },
          {
            title: "反证与限制",
            values: candidate.against,
            className: "ain-against",
          },
          {
            title: "待验证项",
            values: candidate.checks,
            className: "ain-missing",
          },
        ].map(group => (
          <div
            key={group.title}
            className={`ain-evidence-group ${group.className}`}
          >
            <h4>{group.title}</h4>

            {group.values.length ? (
              <ul>
                {group.values.map((value, index) => (
                  <li key={index}>{value}</li>
                ))}
              </ul>
            ) : (
              <p>未提供</p>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

export default function EvidencePanel({
  result,
  pending,
  error,
  title = "故障研判与证据",
  onPrepare,
}: {
  result: Diagnosis | null;
  pending: boolean;
  error: string;
  title?: string;
  onPrepare?: (
    result: Diagnosis,
    candidate: Candidate | null,
  ) => void;
}) {
  const [selection, setSelection] = useState<{
    result: Diagnosis;
    index: number;
  } | null>(null);

  const selectedIndex =
    selection?.result === result ? selection.index : 0;

  const candidate =
    result?.candidates[selectedIndex] || result?.candidates[0];

  const groups = result
    ? apCandidateGroups(result).filter(
        group => group.candidates.length || !group.shownInMain,
      )
    : [];

  const highlights = result
    ? [
        ...result.evidence.filter(
          item => evidenceStatus(item.status) === "warning",
        ),
        ...result.evidence.filter(
          item => evidenceStatus(item.status) !== "warning",
        ),
      ].slice(0, 2)
    : [];

  const stateText =
    result?.state === "empty"
      ? "此范围无可分析数据"
      : result?.state === "normal"
        ? "此范围未检测到明显异常"
        : result?.anomalyType || "后端未提供异常类型";

  return (
    <section className="ain-evidence-slot" aria-live="polite">
      {pending && (
        <p className="ain-analysis-note" role="status">
          正在分析场景内各 AP…
        </p>
      )}

      {error && (
        <p className="ain-query-error" role="alert">
          {error}
        </p>
      )}

      {!result && !pending && !error && (
        <div className="ain-diagnosis-empty">
          <h3>先分析，再查看证据</h3>
          <p>
            点击“分析当前时间段”，或向 AI 助手询问异常原因。
          </p>
        </div>
      )}

      {result && !pending && !error && (
        <>
          <div className="ain-evidence-meta">
            <strong>{title}</strong>
            <span>
              实际研判范围：{scopeLabel(result.scope)} · 按 AP 分析
            </span>
          </div>

          <div className="ain-diagnosis-reading">
          <div className="ain-diagnosis-snapshot">
            <section className="ain-verdict-column">
              <h3 className="ain-verdict-heading">研判结论</h3>
            <div
              className={`ain-diagnosis-overview is-${result.state}`}
            >
              <div className="ain-conclusion-head">
                <h3 data-diagnosis-type={result.anomalyType}>
                  {stateText}
                </h3>

                {result.state === "anomaly" && (
                  <span
                    className="ain-diagnosis-score"
                    title="规则评分不代表概率"
                  >
                    规则评分
                    <strong>{ruleScore(result.score)}</strong>
                  </span>
                )}
              </div>

              {result.state === "anomaly" && (
                <p className="ain-conclusion-tags">
                  <b>{result.level || "等级未提供"}</b>
                  <span>
                    {result.affectedAps.join("、") || "AP 未提供"}
                  </span>
                  <span>原因待验证</span>
                </p>
              )}

              <p className="ain-analysis-observation">
                {result.cause || "后端未提供总结说明。"}
              </p>
            </div>
            </section>

            <section className="ain-evidence-metrics">
              <h3>指标证据与阈值</h3>

              {result.evidence.length ? (
                <div className="ain-evidence-metric-grid">
                  {result.evidence.map((item, index) => (
                    <article
                      key={index}
                      data-evidence-status={evidenceStatus(item.status)}
                      title={evidenceText(item)}
                    >
                      <div className="ain-metric-evidence-head">
                        <h4>{evidenceLabel(item.metric)}</h4>
                        <span>{item.status || "未标注"}</span>
                      </div>

                      <strong>{displayMetric(item.value)}</strong>
                      <p>阈值 {displayMetric(item.threshold)}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="ain-analysis-note">
                  未返回指标证据
                </p>
              )}
            </section>
          </div>

          {result.state === "anomaly" && (
            <div className="ain-reason-strip">
              <h3>判断链路</h3>

              <ol className="ain-reason-flow">
                <li>
                  <span className="ain-flow-label">指标观测</span>
                  {highlights.length ? (
                    highlights.map((item, index) => (
                      <strong key={index}>
                        {evidenceText(item)}
                      </strong>
                    ))
                  ) : (
                    <strong>未返回指标证据</strong>
                  )}
                </li>

                <li>
                  <span className="ain-flow-label">异常判定</span>
                  <strong>{stateText}</strong>
                </li>

                <li>
                  <span className="ain-flow-label">可能原因</span>
                  <strong>
                    {candidate?.cause || "未返回候选原因"}
                  </strong>
                  <span>候选解释</span>
                </li>
              </ol>
            </div>
          )}
          </div>

          {(result.state === "anomaly" ||
            result.candidates.length > 0) && (
            <section className="ain-candidates-v2">
              <div className="ain-candidates-heading">
                <h3>
                  候选原因与验证依据 <span>{result.candidates.length} 项</span>
                </h3>

                <span>
                  {result.state === "anomaly"
                    ? "待验证"
                    : "后端说明 · 未确认故障"}
                </span>
              </div>

              <div
                className="ain-candidate-tabs"
                role="group"
                aria-label="候选原因列表"
              >
                {result.candidates.map((item, index) => (
                  <button
                    type="button"
                    key={index}
                    className={`ain-candidate-button${
                      index === selectedIndex ? " is-selected" : ""
                    }`}
                    aria-pressed={index === selectedIndex}
                    onClick={() => setSelection({ result, index })}
                  >
                    <strong>
                      {item.rank}. {item.cause || "未提供原因名称"}
                    </strong>
                    <span>{ruleScore(item.score)}</span>
                  </button>
                ))}
              </div>

              {candidate ? (
                <CauseCard candidate={candidate} />
              ) : (
                <p className="ain-analysis-note">
                  未返回候选原因
                </p>
              )}
            </section>
          )}

          {result.comparison.length > 0 && (
            <div className="ain-table-scroll">
              <table className="ain-comparison">
                <caption>AP 指标汇总 · 时段均值</caption>

                <thead>
                  <tr>
                    <th scope="col">AP</th>
                    <th scope="col">判定</th>
                    <th scope="col">RSRP / dBm</th>
                    <th scope="col">SINR / dB</th>
                    <th scope="col">吞吐 / Mbps</th>
                    <th scope="col">PRB / %</th>
                  </tr>
                </thead>

                <tbody>
                  {result.comparison.map((item, index) => (
                    <tr
                      key={`${item.id}-${index}`}
                      data-affected={
                        result.state === "anomaly" &&
                        result.affectedAps.includes(item.id)
                      }
                    >
                      <th scope="row">{item.id}</th>
                      <td>
                        {item.type} · {item.level}
                      </td>
                      <td>{displayMetric(item.rsrp)}</td>
                      <td>{displayMetric(item.sinr)}</td>
                      <td>{displayMetric(item.throughput)}</td>
                      <td>{displayMetric(item.prb)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {groups.length > 0 && (
            <details className="ain-more-evidence">
              <summary>
                按 AP 查看候选详情（{groups.length} 组）
                <span className="ain-detail-toggle">
                  <span className="ain-open-label">展开</span>
                  <span className="ain-close-label">收起</span>
                </span>
              </summary>

              {groups.map((item, index) => (
                <div key={index}>
                  <h3>{item.id}</h3>

                  {item.shownInMain > 0 && (
                    <p className="ain-analysis-note">
                      以下为该 AP 的补充候选，重复项已在上方展示。
                    </p>
                  )}

                  {item.candidates.map((cause, i) => (
                    <CauseCard key={i} candidate={cause} />
                  ))}

                  {!item.candidates.length && (
                    <p className="ain-analysis-note">
                      此 AP 未返回候选原因。
                    </p>
                  )}
                </div>
              ))}
            </details>
          )}

          {result.alarms.length > 0 && (
            <details className="ain-more-evidence">
              <summary>
                告警历史（{result.alarms.length} 条）
                <span className="ain-detail-toggle">
                  <span className="ain-open-label">展开</span>
                  <span className="ain-close-label">收起</span>
                </span>
              </summary>

              <ul>
                {result.alarms.map((item, index) => (
                  <li key={index}>
                    <span>
                      {item.time} · {item.ap} · {item.type} ·{" "}
                      {item.level}
                    </span>
                    <p>{item.cause}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {result.state === "anomaly" &&
            result.suggestion.trim() &&
            onPrepare && (
              <div className="ain-prepare-action">
                <strong>下一步：准备验证方案</strong>

                <button
                  type="button"
                  className="ain-button ain-primary"
                  onClick={() => onPrepare(result, candidate || null)}
                >
                  根据此研判准备方案
                </button>
              </div>
            )}
        </>
      )}
    </section>
  );
}