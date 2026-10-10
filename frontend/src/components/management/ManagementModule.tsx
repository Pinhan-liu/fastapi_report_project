import { useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
import type { DashboardData, Diagnosis, MetricKey } from "../../types/backend";
import { METRIC_META } from "../../types/backend";
import { scopeLabel } from "../../services/backend";
import { displayMetric } from "../../services/metrics";
import { buildBaseline, createPlanDraft, EMPTY_DRAFT, isPlanCurrent } from "./managementDraft";
import type { DraftFields, PlanDraft, SuggestionSource } from "./managementDraft";
import { preparePlanFields } from "./preparePlan";
import type { ManagementHandle } from "./preparePlan";
import "./ManagementModule.css";

const COMPARE_METRICS: MetricKey[] = [
  "rsrpDbm", "sinrDb", "throughputMbps", "latencyMs", "packetLossPct", "resourceUtilizationPct",
];
const SOURCE_LABELS: Record<SuggestionSource, string> = {
  manual: "手动方案", current: "当前时间段研判", chat: "AI 对话研判",
};

export default function ManagementModule({ data, diagnosis, chatDiagnosis, focusedApId, ref }: {
  ref?: Ref<ManagementHandle>;
  data: DashboardData;
  diagnosis: Diagnosis | null;
  chatDiagnosis: Diagnosis | null;
  focusedApId: string | null;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const [fields, setFields] = useState<DraftFields>({ ...EMPTY_DRAFT });
  const [source, setSource] = useState<SuggestionSource>("manual");
  const [plan, setPlan] = useState<PlanDraft | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const aps = data.nodes.filter(node => node.type === "ap");
  const suggestion = source === "current" ? diagnosis : source === "chat" ? chatDiagnosis : null;
  const current = plan ? isPlanCurrent(plan, data, fields, source, suggestion) : false;
  const baseline = plan?.baseline || buildBaseline(data, fields.apId);
  const canUseFocus = aps.some(node => node.id === focusedApId);
  const sourceMismatch = suggestion && (
    suggestion.scope.scenario !== data.scope.scenario || suggestion.scope.start !== data.scope.start
    || suggestion.scope.end !== data.scope.end
  );

  useImperativeHandle(ref, () => ({
    prepare(input) {
      // 常显模块：带入方案时聚焦标题并滚动到操作区。
      const panel = panelRef.current;
      if (panel) {
        panel.querySelector<HTMLElement>("header")?.focus({ preventScroll: true });
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      try {
        const next = preparePlanFields(data, input, fields);
        setFields(next); setSource(input.source); setError("");
        setNotice(next.apId ? `已带入研判依据并选择 ${next.apId}，请核对参数与目标值。`
          : "已带入研判依据，请从当前数据中明确选择目标 AP。");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "无法带入研判依据");
        setNotice("");
      }
    },
  }), [data, fields]);

  function edit(key: keyof DraftFields, value: string) {
    setFields(previous => ({ ...previous, [key]: value }));
    setError(""); setNotice("");
  }
  function chooseSource(value: SuggestionSource) {
    setSource(value); setError(""); setNotice("");
  }
  function generate() {
    setError(""); setNotice("");
    try {
      setPlan(createPlanDraft(data, fields, source, suggestion, new Date().toISOString()));
      setNotice("待验证方案已生成，基线已锁定；方案尚未执行。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成草稿失败");
    }
  }
  function exportDraft() {
    if (!plan || !current) return;
    let url = "";
    try {
      const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json;charset=utf-8" });
      url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "AI-NetTune-plan-draft.json";
      document.body.appendChild(link); link.click(); link.remove();
      setNotice("已发起草稿下载，请在浏览器下载列表查看；方案尚未执行。");
    } catch {
      setError("草稿下载未能启动，请检查浏览器下载设置后重试。");
    } finally {
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  return <section ref={panelRef} className="ain-management-module ain-feature-module" id="ain-management-panel" aria-labelledby="ain-management-title">
    <header className="ain-management-summary ain-feature-heading" tabIndex={-1}>
      <span className="ain-module-number" aria-hidden="true">04</span>
      <div className="ain-module-title"><h2 className="ain-feature-title" id="ain-management-title">操作建议与效果验证</h2><p>建议依据 → 方案草稿 → 基线锁定 → 效果验证</p></div>
      <span className="ain-module-state">{plan ? current ? "草稿已生成 · 尚未运行" : "草稿待更新" : "尚未生成草稿"}</span>
    </header>

    <div className="ain-management-content">
      <div className="ain-execution-state ain-execution-top"><strong>仿真执行接口待接入</strong>
        <p>当前可准备与导出待验证方案；运行仿真、应用与回滚尚不可用。</p>
      </div>
      <ol className="ain-management-steps" aria-label="方案准备流程">
        <li data-active={!fields.apId}><span>1</span>确认对象与依据</li>
        <li data-active={Boolean(fields.apId) && !current}><span>2</span>填写待验证方案</li>
        <li data-active={current}><span>3</span>锁定基线并导出</li>
        <li aria-disabled="true"><span>4</span>仿真与效果对比 · 待接入</li>
      </ol>
      <p className="ain-management-scope">当前数据：{scopeLabel(data.scope)}</p>
      <div className="ain-management-grid">
        <section className="ain-management-column" aria-labelledby="ain-plan-heading">
          <div className="ain-management-column-title"><h3 id="ain-plan-heading">操作建议与方案草稿</h3><span>尚未执行</span></div>
          <section className="ain-plan-source-group" aria-label="研判建议">
            <h4 className="ain-group-heading">研判建议</h4>
          {([ ["current", diagnosis], ["chat", chatDiagnosis] ] as const).map(([key, result]) =>
            result?.suggestion ? <article className="ain-suggestion-card" key={key}>
              <h4>{SOURCE_LABELS[key]} · 后端原始建议</h4>
              <p className="ain-management-muted">{scopeLabel(result.scope)}</p>
              <p className="ain-suggestion-text">{result.suggestion}</p>
              <button type="button" className="ain-button" onClick={() => chooseSource(key)} aria-pressed={source === key}>
                {source === key ? "已选为方案依据" : "作为方案依据"}
              </button>
            </article> : null,
          )}
          {!diagnosis?.suggestion && !chatDiagnosis?.suggestion && <p className="ain-management-empty">暂无操作建议。可先完成研判，或手动填写方案草稿。</p>}
          </section>

          <form className="ain-plan-form" onSubmit={event => { event.preventDefault(); generate(); }}>
            <fieldset className="ain-plan-fieldset">
              <legend>方案对象与依据</legend>
              <div className="ain-field-grid">
            <label className="ain-form-full">方案依据
              <select value={source} onChange={event => chooseSource(event.target.value as SuggestionSource)}>
                <option value="manual">手动方案（不引用建议）</option>
                <option value="current" disabled={!diagnosis?.suggestion}>当前时间段研判建议</option>
                <option value="chat" disabled={!chatDiagnosis?.suggestion}>AI 对话研判建议</option>
              </select>
            </label>
            {sourceMismatch && <p className="ain-management-warning ain-form-full">所选建议范围与当前数据不同。请加载对应范围，或改为手动方案。</p>}
            <label>方案名称<input required value={fields.name} placeholder="例如：AP1 覆盖优化草稿" onChange={event => edit("name", event.target.value)} /></label>
            <label>目标 AP<select required value={fields.apId} onChange={event => edit("apId", event.target.value)}>
              <option value="">请选择目标 AP</option>
              {aps.map(node => <option key={node.id} value={node.id}>{node.id}</option>)}
            </select></label>
            <div className="ain-form-full ain-use-focus"><button type="button" className="ain-button" disabled={!canUseFocus}
              onClick={() => { if (focusedApId && canUseFocus) edit("apId", focusedApId); }}>
              使用当前关注 AP{canUseFocus ? `：${focusedApId}` : "（先点击上方 AP）"}
            </button></div>
              </div>
            </fieldset>
            <fieldset className="ain-plan-fieldset">
              <legend>调整参数与备注</legend>
              <div className="ain-field-grid">
            <label>调整参数<input required value={fields.parameter} placeholder="填写拟调整的配置项" onChange={event => edit("parameter", event.target.value)} /></label>
            <label>目标值<input required value={fields.targetValue} placeholder="填写拟设定值" onChange={event => edit("targetValue", event.target.value)} /></label>
            <label>单位（可选）<input value={fields.unit} placeholder="例如 dBm" onChange={event => edit("unit", event.target.value)} /></label>
            <div className="ain-current-config"><span>当前参数配置</span><strong>原接口未返回</strong></div>
            <label className="ain-form-full">备注（可选）<textarea rows={2} value={fields.note} placeholder="记录调整目的、约束或待验证内容" onChange={event => edit("note", event.target.value)} /></label>
              </div>
            </fieldset>
            <p className="ain-management-muted ain-form-full">参数与目标值仅保存为草稿；支持的参数、单位和允许范围尚需后端校验。</p>
            <div className="ain-plan-actions ain-form-full">
              <button className="ain-button ain-primary" type="submit">生成待验证方案</button>
              <button className="ain-button" type="button" disabled={!plan || !current} onClick={exportDraft}>导出草稿 JSON</button>
              <button className="ain-button" type="button" onClick={() => {
                setFields({ ...EMPTY_DRAFT }); setSource("manual"); setPlan(null); setError(""); setNotice("");
              }}>清空草稿</button>
            </div>
            <p className="ain-management-muted ain-form-full">生成时锁定所选 AP 的历史采样基线，便于后续核对同条件的验证结果。</p>
          </form>
          {error && <p className="ain-management-warning" role="alert">{error}</p>}
          {notice && <p className="ain-management-notice" role="status">{notice}</p>}
          {plan && !current && <p className="ain-management-warning">编辑内容、建议或数据已变化，请重新生成草稿。右侧仍展示上一次锁定的基线。</p>}
          <p className="ain-management-muted">草稿保存在当前页面。重新加载数据或刷新页面会清空，保留前请先导出。</p>
        </section>

        <section className="ain-management-column" aria-labelledby="ain-effect-heading">
          <div className="ain-management-column-title"><h3 id="ain-effect-heading">基线与效果对比</h3><span>{plan ? "已锁定基线" : "基线预览"}</span></div>
          {plan && <p className="ain-plan-overview"><strong>{plan.fields.name}</strong> · {plan.fields.apId} · {plan.fields.parameter} → {plan.fields.targetValue} {plan.fields.unit}<br />依据：{SOURCE_LABELS[plan.suggestion.source]} · 尚未运行</p>}
          {baseline ? <div className="ain-baseline-info">
            <strong>{baseline.apId} · 所选 AP 关联采样记录均值</strong>
            <p>{scopeLabel(baseline.scope)}</p>
            <p>{baseline.sampleCount} 条采样 · {baseline.ueIds.length} 个 UE · 各指标仅统计有效值</p>
          </div> : <p className="ain-management-empty">选择目标 AP 后预览真实采样基线；该 AP 无记录时无法生成方案。</p>}
          {baseline && <div className="ain-comparison-table-wrap"><table className="ain-comparison-table">
            <caption>指标对比 · 吞吐量为采样均值，不是 AP 总吞吐量</caption>
            <thead><tr><th scope="col">指标</th><th scope="col">基线 / 有效条数</th><th scope="col">方案后</th><th scope="col">变化</th></tr></thead>
            <tbody>{COMPARE_METRICS.map(key => <tr key={key}>
              <th scope="row">{METRIC_META[key].label}</th>
              <td>{displayMetric(baseline?.metrics[key].mean ?? undefined)} {METRIC_META[key].unit}<small>{baseline?.metrics[key].count ?? 0} 条有效</small></td>
              <td>尚未运行</td><td>待验证</td>
            </tr>)}</tbody>
          </table></div>}
          <div className="ain-effect-pending">
            <h4>效果验证 · 等待执行结果</h4>
            <p>接入仿真后，在这里直接展示：</p>
            <ul><li>同一验证窗口的指标趋势对比</li><li>同网格、同色标的 RadioMap 前后对比</li><li>同节点范围的连接关系前后对比</li></ul>
          </div>
          <div className="ain-execution-controls">
            <div className="ain-plan-actions">
              <button type="button" className="ain-button" disabled>运行仿真</button>
              <button type="button" className="ain-button" disabled>应用方案</button>
              <button type="button" className="ain-button" disabled>回滚方案</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </section>;
}
