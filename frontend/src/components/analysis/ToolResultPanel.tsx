import type { EChartsOption } from "echarts";
import type { ChatResult } from "../../types/backend";
import { scopeLabel } from "../../services/backend";
import ChartPanel, { AXIS_STYLE, CHART_BACKGROUND } from "../charts/ChartPanel";
import EvidencePanel from "./EvidencePanel";

export default function ToolResultPanel({ result }: { result: ChatResult | null }) {
  if (!result) return null;
  const raw = result.chart?.option;
  let option: EChartsOption | null = null;
  let title = "";
  if (raw && result.chart?.type === "heatmap") {
    title = "对话工具热力图";
    option = { ...raw, animation: false, backgroundColor: CHART_BACKGROUND,
      tooltip: { trigger: "item", renderMode: "richText", formatter: (p: unknown) => {
        const values = (p as { value?: unknown }).value;
        return Array.isArray(values) ? `网格索引 (${values[0]}, ${values[1]})\nRSRP ${Number(values[2]).toFixed(1)} dBm` : "无数据";
      } },
      xAxis: { ...(raw.xAxis as object), ...AXIS_STYLE },
      yAxis: { ...(raw.yAxis as object), ...AXIS_STYLE },
      visualMap: { ...(raw.visualMap as object), textStyle: { color: "#b5c7d5" } },
    } as EChartsOption;
  } else if (raw && result.chart?.type === "graph") {
    title = "对话工具连接汇总";
    const nodes = Array.isArray(raw.nodes) ? raw.nodes as { id: string; category: string }[] : [];
    option = { animation: false, backgroundColor: CHART_BACKGROUND,
      tooltip: { renderMode: "richText" },
      series: [{ type: "graph", layout: "force", roam: true, force: { repulsion: 220 },
        label: { show: true, color: "#d8e9ed", position: "right" },
        lineStyle: { color: "#718b9d", width: 2 },
        data: nodes.map(n => ({ id: n.id, name: n.id, symbolSize: n.category === "AP" ? 28 : 18,
          itemStyle: { color: n.category === "AP" ? "#7ec7bc" : "#8eb8d0" } })),
        links: Array.isArray(raw.links) ? raw.links as { source: string; target: string }[] : [],
      }],
    };
  }
  // 诊断工具的小时趋势取“每小时最严重 AP”，并非同一对象的时间曲线。
  // P0 用完整诊断证据呈现，不把这种序列混入当前 UE 的趋势图。
  return <section className="ain-tool-result">
    <h2>对话工具返回</h2><p className="ain-analysis-note">{scopeLabel(result.scope)} · 工具：{result.intent}</p>
    <p className="ain-analysis-observation">{result.reply}</p>
    <p className="ain-analysis-note">工具范围独立于页面筛选。后端未返回意图解析使用模型还是规则，本页不作推断。</p>
    {option && <ChartPanel title={title} description={result.chart?.type === "graph" ? "全工具时间段内出现过的服务连接；非同一时刻拓扑" : "后端 UE 采样网格均值；空白网格无数据"} option={option} height={340} />}
    {result.diagnosis && <EvidencePanel title="对话范围故障研判" result={result.diagnosis} pending={false} error="" />}
  </section>;
}
