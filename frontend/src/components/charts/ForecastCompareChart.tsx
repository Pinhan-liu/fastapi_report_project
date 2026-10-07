import type { EChartsOption } from "echarts";
import type { ForecastResult, ForecastMetric } from "../../types/backend";
import ChartPanel, { AXIS_STYLE, CHART_BACKGROUND } from "./ChartPanel";
import "./ForecastCompareChart.css";

// 与论文 Fig 对齐的映射：Signal Power→RSRP、Interference→SINR、Rate→吞吐量
const METRICS: { key: ForecastMetric; label: string; unit: string }[] = [
  { key: "rsrp", label: "信号强度 Signal Power", unit: "dBm" },
  { key: "sinr", label: "干扰相关 SINR", unit: "dB" },
  { key: "throughput", label: "可达吞吐量 Rate", unit: "Mbps" },
];

export default function ForecastCompareChart({ forecast, pending, error }: {
  forecast: ForecastResult | null; pending: boolean; error: string;
}) {
  if (pending) return <p className="ain-load-state">正在生成 真实 vs 预测 对比…</p>;
  if (error) return <div className="ain-error" role="alert"><p>{error}</p></div>;
  if (!forecast) return null;
  const ues = forecast.ues;
  if (!ues.length) return <div className="ain-load-state"><p>所选范围暂无预测数据</p></div>;
  return <section className="ain-forecast-section">
    <div className="ain-section-heading"><h2>信号质量预测对比（真实 vs 预测）</h2>
      <p>{forecast.method} · {forecast.bin_size_min} 分钟桶 · 前 60% 训练 / 后 40% 测试 · 场景「{forecast.scenario}」</p>
    </div>
    <div className="ain-forecast-grid">
      {METRICS.map(m => {
        const trueData = ues.map(ue => forecast.series[ue]?.[m.key]?.true_mean ?? null);
        const predData = ues.map(ue => forecast.series[ue]?.[m.key]?.pred_mean ?? null);
        const mapeValues = ues.map(ue => forecast.series[ue]?.[m.key]?.mape).filter((v): v is number => v != null);
        const avgMape = mapeValues.length ? (mapeValues.reduce((a, b) => a + b, 0) / mapeValues.length).toFixed(1) : "—";
        const option: EChartsOption = {
          animation: false, backgroundColor: CHART_BACKGROUND,
          tooltip: { trigger: "axis", valueFormatter: (v: unknown) => String(v) },
          legend: { data: ["实测 True", "预测 Predicted"], textStyle: { color: "#b5c7d5" }, top: 4 },
          grid: { left: 70, right: 18, top: 44, bottom: 30 },
          xAxis: { type: "category", data: ues, ...AXIS_STYLE },
          yAxis: { type: "value", name: m.unit, nameTextStyle: { color: "#b5c7d5", fontSize: 11 }, ...AXIS_STYLE },
          series: [
            { name: "实测 True", type: "bar", barWidth: 16, itemStyle: { color: "#f39c12" }, data: trueData },
            { name: "预测 Predicted", type: "bar", barWidth: 16, itemStyle: { color: "#3498db" }, data: predData },
          ],
        };
        return <ChartPanel key={m.key} title={m.label}
          description={`测试段均值对比 · MAPE 平均 ${avgMape}%`} option={option} height={215} />;
      })}
    </div>
  </section>;
}
