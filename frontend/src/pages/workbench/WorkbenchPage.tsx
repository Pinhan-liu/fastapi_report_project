import { useEffect, useRef, useState } from "react";
import { analyzeNetwork, CASE_WINDOWS, DEFAULT_SCOPE, loadDashboard, scopeLabel } from "../../services/backend";
import type { DashboardData, Diagnosis, QueryScope } from "../../types/backend";
import { displayMetric, getLatestFrame } from "../../services/metrics";
import useNetworkQuery from "../../hooks/useNetworkQuery";
import QueryPanel from "../../chat/QueryPanel";
import EvidencePanel from "../../components/analysis/EvidencePanel";
import ToolResultPanel from "../../components/analysis/ToolResultPanel";
import KpiSummary from "../../components/charts/KpiSummary";
import RadioMapChart from "../../components/charts/RadioMapChart";
import TopologyChart from "../../components/charts/TopologyChart";
import MetricCharts from "../../components/charts/MetricCharts";
import TrendChart from "../../components/charts/TrendChart";
import "./WorkbenchPage.css";
import "./BackendIntegration.css";

export default function WorkbenchPage() {
  const [scope, setScope] = useState<QueryScope>({ ...DEFAULT_SCOPE });
  const [draft, setDraft] = useState<QueryScope>({ ...DEFAULT_SCOPE });
  const [caseIndex, setCaseIndex] = useState("0");
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedUeId, setSelectedUeId] = useState("");
  const [focusedApId, setFocusedApId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const analysisController = useRef<AbortController | null>(null);
  const query = useNetworkQuery();

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    query.reset(); analysisController.current?.abort(); analysisController.current = null;
    setDiagnosis(null); setAnalyzing(false); setAnalysisError("");
    setData(null); setLoading(true); setError(""); setFocusedApId(null);
    loadDashboard(scope, controller.signal).then(result => {
      if (!active) return;
      setData(result);
      setSelectedUeId(previous => result?.nodes.some(n => n.type === "ue" && n.id === previous)
        ? previous : result?.nodes.find(n => n.type === "ue")?.id || "");
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "数据读取失败");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); analysisController.current?.abort(); };
  }, [scope, query.reset]);

  async function analyze() {
    if (!data || loading || analysisController.current) return;
    const controller = new AbortController(); analysisController.current = controller;
    setAnalyzing(true); setAnalysisError(""); setDiagnosis(null);
    try {
      const result = await analyzeNetwork(data.scope, controller.signal);
      if (analysisController.current === controller) setDiagnosis(result);
    } catch (reason) {
      if (analysisController.current === controller && !controller.signal.aborted)
        setAnalysisError(reason instanceof Error ? reason.message : "分析失败");
    } finally {
      if (analysisController.current === controller) { analysisController.current = null; setAnalyzing(false); }
    }
  }
  const ues = data?.nodes.filter(n => n.type === "ue") || [];
  const latest = getLatestFrame(data?.metrics || []).metrics.find(r => r.ueId === selectedUeId);
  const serving = data?.links.filter(l => l.target === selectedUeId) || [];
  const focused = data?.nodes.find(n => n.type === "ap" && n.id === focusedApId);
  function selectUE(id: string) {
    if (ues.some(n => n.id === id)) { setSelectedUeId(id); setFocusedApId(null); }
  }
  function focusAP(id: string) {
    if (data?.nodes.some(n => n.type === "ap" && n.id === id)) setFocusedApId(id);
  }
  function timeInput(value: string) {
    return value.replace("T", " ") + (value.length === 16 ? ":00" : "");
  }
  return <main className="ain-workbench">
    <div className="ain-page-heading"><div><p className="ain-eyebrow">OBSERVE / EXPLAIN / MANAGE</p><h1>网络分析与管理</h1><p className="ain-muted">采样分布、连接与指标联动；围绕候选原因组织证据。</p></div>
      <div className="ain-heading-controls"><button className="ain-button" disabled={loading} onClick={() => setScope({ ...scope })}>重新载入</button><button className="ain-button" aria-expanded={panelOpen} aria-controls="ain-management-panel" onClick={() => setPanelOpen(v => !v)}>{panelOpen ? "收起面板" : "展开面板"}</button></div>
    </div>
    <form className="ain-scope-form" onSubmit={event => { event.preventDefault(); setScope({ ...draft }); }}>
      <label>场景<select value={draft.scenario} onChange={e => setDraft(v => ({ ...v, scenario: e.target.value }))}>{["校园", "商场", "体育馆"].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>演示时段<select value={caseIndex} onChange={e => { const value = e.target.value; setCaseIndex(value); const item = CASE_WINDOWS[Number(value)]; if (item) setDraft(v => ({ ...v, start: item.start, end: item.end })); }}>
        {CASE_WINDOWS.map((c, i) => <option key={c.label} value={String(i)}>{c.label}</option>)}<option value="custom">自定义范围</option>
      </select></label>
      <label>开始时间<input type="datetime-local" step="1" required value={draft.start.replace(" ", "T")} onChange={e => { setCaseIndex("custom"); setDraft(v => ({ ...v, start: timeInput(e.target.value) })); }} /></label>
      <label>结束时间<input type="datetime-local" step="1" required value={draft.end.replace(" ", "T")} onChange={e => { setCaseIndex("custom"); setDraft(v => ({ ...v, end: timeInput(e.target.value) })); }} /></label>
      <button className="ain-button ain-primary">加载所选范围</button><p>北京时间 · CSV 仅有校园 2026-01-01—01-03 · 预设名称用于演示，最终判定由后端计算</p>
    </form>
    {loading && <p className="ain-load-state" role="status">正在读取所选范围的记录与拓扑…</p>}
    {error && <div className="ain-error" role="alert"><p>{error}</p><button className="ain-button" onClick={() => setScope({ ...scope })}>重试</button></div>}
    {!loading && !error && !data && <div className="ain-load-state"><h2>所选场景与时间段暂无数据</h2><p>{scopeLabel(scope)}</p><p>请切回校园已有时间段。当前文件没有商场和体育馆的数据。</p></div>}
    {data && <>
      <div className="ain-data-bar"><span className="ain-source-badge">CSV 仿真历史数据</span><span>{data.metrics.length} 条记录</span><span>{data.nodes.filter(n => n.type === "ap").length} AP / {ues.length} UE</span><span>最新采样：{data.metrics.at(-1)?.backendTime}</span>
        <label htmlFor="ain-selected-ue">指标对象<select id="ain-selected-ue" value={selectedUeId} onChange={e => selectUE(e.target.value)}>{ues.map(n => <option key={n.id}>{n.id}</option>)}</select></label>
        <p className="ain-loaded-scope">已加载：{scopeLabel(data.scope)}</p>
      </div>
      <div className={`ain-workbench-grid${panelOpen ? "" : " ain-panel-closed"}`}>
        <div className="ain-data-column">
          <KpiSummary data={data} ueId={selectedUeId} />
          <div className="ain-main-grid"><div className="ain-large-charts">
            <RadioMapChart data={data} ueId={selectedUeId} focusedApId={focusedApId} onSelectUE={selectUE} onFocusAP={focusAP} />
            <TopologyChart data={data} ueId={selectedUeId} focusedApId={focusedApId} onSelectUE={selectUE} onFocusAP={focusAP} />
          </div><MetricCharts data={data} ueId={selectedUeId} onSelect={selectUE} /></div>
          <EvidencePanel result={diagnosis} pending={analyzing} error={analysisError} />
          <div className="ain-trend-slot"><TrendChart data={data} ueId={selectedUeId} /></div>
          <ToolResultPanel result={query.result} />
        </div>
        {panelOpen && <aside id="ain-management-panel" className="ain-side-panel" aria-label="分析与管理面板">
          <div className="ain-panel-heading"><h2>分析与管理</h2><span>指标对象与场景诊断分别标注</span></div>
          <section className="ain-object-details"><h3>{selectedUeId || "未选择对象"} / 指标对象</h3><dl>
            <div><dt>服务 AP</dt><dd>{serving.map(l => l.source).join("、") || "无"}</dd></div>
            <div><dt>最新 RSRP</dt><dd>{displayMetric(latest?.rsrpDbm)} dBm</dd></div>
            <div><dt>最新 SINR</dt><dd>{displayMetric(latest?.sinrDb)} dB</dd></div>
            <div><dt>最新吞吐量</dt><dd>{displayMetric(latest?.throughputMbps)} Mbps</dd></div>
            <div><dt>采样时间</dt><dd>{latest?.backendTime || "暂无数据"}</dd></div>
          </dl></section>
          {focused && <section className="ain-object-details ain-ap-focus"><h3>拓扑关注 / {focused.id}</h3><p>坐标：({focused.x}, {focused.y}) m</p><div className="ain-ap-ue-buttons">{data.links.filter(l => l.source === focused.id).map(l => <button key={l.id} className="ain-button" onClick={() => selectUE(l.target)}>{l.target} / {displayMetric(l.throughput)} Mbps</button>)}</div></section>}
          <QueryPanel query={query} scenario={data.scope.scenario} disabled={loading} />
          <section className="ain-management-slot"><h3>动态管理 / 仿真验证</h3><p className="ain-muted">配置修改、仿真运行及前后对比属于后续管理接口，本批先完成观测与故障展示。</p><button className="ain-button" disabled>管理接口待接入</button></section>
        </aside>}
      </div>
      <div className="ain-bottom-actions"><button className="ain-button ain-primary" disabled={loading || analyzing} onClick={() => void analyze()}>{analyzing ? "正在分析…" : "分析当前时间段"}</button><button className="ain-button" disabled>运行仿真</button><button className="ain-button" disabled>对比方案</button><button className="ain-button" disabled>保存分析</button><span className="ain-muted">分析范围为已加载场景内各 AP；点击 UE 只切换指标对象。</span></div>
    </>}
  </main>;
}
