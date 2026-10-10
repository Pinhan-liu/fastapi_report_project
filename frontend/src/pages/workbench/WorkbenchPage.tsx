import type { DiagnosisHandle } from "../../components/analysis/DiagnosisModule";
import { useEffect, useRef, useState } from "react";
import { analyzeNetwork, CASE_WINDOWS, DEFAULT_SCOPE, fetchForecast, loadDashboard, scopeLabel } from "../../services/backend";
import type { DashboardData, Diagnosis, ForecastResult, QueryScope } from "../../types/backend";
import { displayMetric, getLatestFrame } from "../../services/metrics";
import useNetworkQuery from "../../hooks/useNetworkQuery";
import QueryPanel from "../../chat/QueryPanel";
import DiagnosisModule from "../../components/analysis/DiagnosisModule";
import type { ManagementHandle } from "../../components/management/preparePlan";
import ManagementModule from "../../components/management/ManagementModule";
import ToolResultPanel from "../../components/analysis/ToolResultPanel";
import KpiSummary from "../../components/charts/KpiSummary";
import RadioMapChart from "../../components/charts/RadioMapChart";
import TopologyChart from "../../components/charts/TopologyChart";
import MetricCharts from "../../components/charts/MetricCharts";
import TrendChart from "../../components/charts/TrendChart";
import ForecastCompareChart from "../../components/charts/ForecastCompareChart";
import "./WorkbenchPage.css";
import "./BackendIntegration.css";

export default function WorkbenchPage() {
  const [scope, setScope] = useState<QueryScope>({ ...DEFAULT_SCOPE });
  const [draft, setDraft] = useState<QueryScope>({ ...DEFAULT_SCOPE });
  const [caseIndex, setCaseIndex] = useState("0");
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedUeId, setSelectedUeId] = useState("");
  const [focusedApId, setFocusedApId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const analysisController = useRef<AbortController | null>(null);
  const query = useNetworkQuery();
  const diagnosisRef = useRef<DiagnosisHandle>(null);
  const managementRef = useRef<ManagementHandle>(null);

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

  useEffect(() => {
    if (!data) { setForecast(null); return; }
    const controller = new AbortController(); let active = true;
    setForecastLoading(true); setForecastError(""); setForecast(null);
    fetchForecast(data.scope, controller.signal).then(result => {
      if (active) setForecast(result);
    }).catch(reason => {
      if (active) setForecastError(reason instanceof Error ? reason.message : "预测对比生成失败");
    }).finally(() => { if (active) setForecastLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [data]);
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
  return (
    <main className="ain-workbench">
      <div className="ain-workbench-title">
        <div>
          <h1>现存问题 · 网络分析与管理</h1>
          <p>观察指标与连接，围绕具体异常核查原因。</p>
        </div>
        <span className="ain-source-badge">后端接口数据</span>
      </div>

      <nav className="ain-workflow-nav" aria-label="工作台功能流程">
        <a className="ain-workflow-ai" href="#ain-ai-module"><span>01</span><strong>AI 对话交互</strong><small>描述问题</small></a>
        <a href="#ain-data-module"><span>02</span><strong>数据展示</strong><small>观察指标与图表</small></a>
        <a href={data ? "#ain-diagnosis-module" : undefined} aria-disabled={!data}><span>03</span><strong>故障研判与证据</strong><small>核查原因与依据</small></a>
        <a href={data ? "#ain-management-panel" : undefined} aria-disabled={!data}><span>04</span><strong>操作建议与效果验证</strong><small>准备方案与验证</small></a>
      </nav>

      <QueryPanel
        query={query}
         scenario={data?.scope.scenario || scope.scenario}
         window={data?.scope || scope}
         disabled={!data || loading}
         onViewDiagnosis={() => diagnosisRef.current?.showChat()}
       />

      <section className="ain-data-module ain-feature-module" id="ain-data-module" aria-labelledby="ain-data-title">
        <header className="ain-feature-heading ain-data-heading">
          <span className="ain-module-number" aria-hidden="true">02</span>
          <div className="ain-module-title">
            <h2 className="ain-feature-title" id="ain-data-title">数据展示</h2>
            <p>加载范围 → 选择对象 → 观察指标、地图与趋势</p>
          </div>
          <span className="ain-feature-context">为研判提供观测依据</span>
        </header>
      <section className="ain-filter-panel" aria-label="数据范围与来源">
        <form
          className="ain-scope-form"
          onSubmit={event => {
            event.preventDefault();
            setScope({ ...draft });
          }}
        >
          <label>场景
            <select value={draft.scenario} onChange={event => setDraft(value => ({ ...value, scenario: event.target.value }))}>
              {["校园", "商场", "体育馆"].map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>演示时段
            <select value={caseIndex} onChange={event => {
              const value = event.target.value;
              setCaseIndex(value);
              const item = CASE_WINDOWS[Number(value)];
              if (item) setDraft(previous => ({ ...previous, start: item.start, end: item.end }));
            }}>
              {CASE_WINDOWS.map((item, index) => <option key={item.label} value={String(index)}>{item.label}</option>)}
              <option value="custom">自定义范围</option>
            </select>
          </label>
          <label>开始时间
            <input type="datetime-local" step="1" required value={draft.start.replace(" ", "T")} onChange={event => {
              setCaseIndex("custom");
              setDraft(value => ({ ...value, start: timeInput(event.target.value) }));
            }} />
          </label>
          <label>结束时间
            <input type="datetime-local" step="1" required value={draft.end.replace(" ", "T")} onChange={event => {
              setCaseIndex("custom");
              setDraft(value => ({ ...value, end: timeInput(event.target.value) }));
            }} />
          </label>
          <button className="ain-button ain-primary" disabled={loading}>加载所选范围</button>
          <button type="button" className="ain-button ain-reload" disabled={loading} onClick={() => setScope({ ...scope })}>重新载入</button>
        </form>
        <p className="ain-filter-note">
           数据范围：2026-01-01 至 2026-01-30（北京时间）；
          当前仅支持校园场景，单次最多查询3天。
        </p>
        {data && <div className="ain-data-bar">
          <span className="ain-source-badge">CSV 仿真历史数据</span>
          <span>{data.metrics.length} 条记录</span>
          <span>{data.nodes.filter(node => node.type === "ap").length} AP / {ues.length} UE</span>
          <span>最新采样：{data.metrics.at(-1)?.backendTime}</span>
          <p className="ain-loaded-scope">已加载：{scopeLabel(data.scope)}</p>
        </div>}
      </section>

      {loading && <p className="ain-load-state" role="status">正在读取所选范围的记录与拓扑…</p>}
      {error && <div className="ain-error" role="alert">
        <p>{error}</p>
        <button className="ain-button" onClick={() => setScope({ ...scope })}>重试</button>
      </div>}
      {!loading && !error && !data && <div className="ain-load-state">
        <h2>所选场景与时间段暂无数据</h2>
        <p>{scopeLabel(scope)}</p>
        <p>请切回校园已有时间段。当前文件没有商场和体育馆的数据。</p>
      </div>}

      {data && <>
        <section className="ain-object-bar" aria-label="当前指标对象">
          <label htmlFor="ain-panel-ue">指标对象
            <select id="ain-panel-ue" value={selectedUeId} onChange={event => selectUE(event.target.value)}>
              {ues.map(node => <option key={node.id}>{node.id}</option>)}
            </select>
          </label>
          <span>服务 AP <strong>{serving.map(link => link.source).join("、") || "无"}</strong></span>
          <span>对象采样：{latest?.backendTime || "暂无数据"}</span>
          <p>选择 UE 联动指标与图表；故障研判仍按已加载场景内各 AP 分析。</p>
        </section>

        {focused && <section className="ain-ap-focus-bar" aria-label="当前关注 AP">
          <span>关注 <strong>{focused.id}</strong> · 坐标 ({focused.x}, {focused.y}) m</span>
          <div className="ain-ap-ue-buttons">
            {data.links.filter(link => link.source === focused.id).map(link => (
              <button key={link.id} className="ain-button" onClick={() => selectUE(link.target)}>
                {link.target} / {displayMetric(link.throughput)} Mbps
              </button>
            ))}
          </div>
          <button className="ain-button" onClick={() => setFocusedApId(null)}>取消关注</button>
        </section>}

        <KpiSummary data={data} ueId={selectedUeId} />

        <div className="ain-main-grid">
          <div className="ain-large-charts">
            <RadioMapChart data={data} ueId={selectedUeId} focusedApId={focusedApId} onSelectUE={selectUE} onFocusAP={focusAP} />
            <TopologyChart data={data} ueId={selectedUeId} focusedApId={focusedApId} onSelectUE={selectUE} onFocusAP={focusAP} />
          </div>
          <MetricCharts data={data} ueId={selectedUeId} onSelect={selectUE} />
        </div>

        <div className="ain-trend-slot">
          <TrendChart data={data} ueId={selectedUeId} />
        </div>

        <ForecastCompareChart forecast={forecast} pending={forecastLoading} error={forecastError} />

        {query.result?.chart && <ToolResultPanel result={query.result} />}

      </>}
      </section>

      {data && <>
        <DiagnosisModule
          ref={diagnosisRef}
          result={diagnosis}
          pending={analyzing}
          error={analysisError}
          chatDiagnosis={query.result?.diagnosis || null}
          scope={data.scope}
          onAnalyze={() => void analyze()}
          onPrepare={(input) => managementRef.current?.prepare(input)}
        />

        <div className="ain-module-handoff" aria-label="研判与操作区的衔接">
          <div><strong>研判依据</strong><span aria-hidden="true">→</span><strong>方案草稿</strong><span aria-hidden="true">→</span><strong>基线与效果验证</strong></div>
          <p>点击上方“根据此研判准备方案”，带入研判依据与可识别的目标 AP；核对参数后生成草稿并锁定基线。</p>
        </div>

        <ManagementModule
          ref={managementRef}
          data={data}
          diagnosis={diagnosis}
          chatDiagnosis={query.result?.diagnosis || null}
          focusedApId={focusedApId}
        />
      </>}
    </main>
  );
}
