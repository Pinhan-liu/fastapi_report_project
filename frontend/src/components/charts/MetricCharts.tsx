import type { EChartsOption } from "echarts";
import type { DashboardData, MetricKey } from "../../types/backend";
import { METRIC_META } from "../../types/backend";
import { getLatestFrame } from "../../services/metrics";
import ChartPanel, { AXIS_STYLE, CHART_BACKGROUND } from "./ChartPanel";

const ITEMS: { key: MetricKey; title: string; className: string }[] = [
  {
    key: "throughputMbps",
    title: "吞吐量",
    className: "ain-metric-throughput",
  },
  { key: "latencyMs", title: "时延", className: "ain-metric-latency" },
  { key: "packetLossPct", title: "丢包率", className: "ain-metric-loss" },
];
export default function MetricCharts({
  data,
  ueId,
  onSelect,
}: {
  data: DashboardData;
  ueId: string;
  onSelect: (id: string) => void;
}) {
  const frame = getLatestFrame(data.metrics);
  const ues = data.nodes.filter((node) => node.type === "ue");
  return (
    <div className="ain-small-charts">
      {ITEMS.map(({ key, title, className }) => {
        const unit = METRIC_META[key].unit;
        const option: EChartsOption = {
          animation: false,
          backgroundColor: CHART_BACKGROUND,
          grid: { left: 34, right: 12, top: 19, bottom: 22 },
          tooltip: {
            trigger: "item",
            renderMode: "richText",
            valueFormatter: (value) =>
              value == null
                ? "暂无数据"
                : `${Number(value).toFixed(1)} ${unit}`,
          },
          xAxis: {
            ...AXIS_STYLE,
            type: "category",
            data: ues.map((ue) => ue.id),
            axisLabel: { ...AXIS_STYLE.axisLabel, interval: 0 },
          },
          yAxis: { ...AXIS_STYLE, type: "value", min: 0, splitNumber: 2 },
          series: [
            {
              name: title,
              type: "bar",
              barMaxWidth: 23,
              label: {
                show: true,
                position: "top",
                color: "#c4d5df",
                fontSize: 9,
              },
              data: ues.map((ue) => {
                const record = frame.metrics.find(
                  (item) => item.ueId === ue.id,
                );
                return {
                  name: ue.id,
                  value: record && Number.isFinite(record[key]) ? Number(record[key].toFixed(1)) : null,
                  itemStyle: {
                    color: ue.id === ueId ? "#efab65" : "#71a7c7",
                    borderRadius: [2, 2, 0, 0],
                  },
                };
              }),
            },
          ],
        };
        return (
          <ChartPanel
            key={key}
            title={title}
            description={`${unit} · 同时刻比较 / 橙色为当前对象`}
            option={option}
            height={90}
            className={className}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
