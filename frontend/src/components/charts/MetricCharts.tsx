import type { EChartsOption } from "echarts";
import type { DashboardData, MetricKey } from "../../types/backend";
import { METRIC_META } from "../../types/backend";
import { getLatestFrame } from "../../services/metrics";
import ChartPanel, { LIGHT_AXIS_STYLE, CHART_FONT } from "./ChartPanel";

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
          backgroundColor: "#ffffff",
          textStyle: { fontFamily: CHART_FONT },
          grid: { left: 10, right: 14, top: 25, bottom: 8, containLabel: true },
          tooltip: {
            trigger: "item",
            renderMode: "richText",
            valueFormatter: (value) =>
              value == null
                ? "暂无数据"
                : `${Number(value).toFixed(1)} ${unit}`,
          },
          xAxis: {
            ...LIGHT_AXIS_STYLE,
            type: "category",
            data: ues.map((ue) => ue.id),
            axisLabel: { ...LIGHT_AXIS_STYLE.axisLabel, interval: 0 },
          },
          yAxis: { ...LIGHT_AXIS_STYLE, type: "value", min: 0, splitNumber: 2 },
          series: [
            {
              name: title,
              type: "bar",
              barMaxWidth: 46,
              label: {
                show: true,
                position: "top",
                color: "#102c65",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: CHART_FONT,
              },
              data: ues.map((ue) => {
                const record = frame.metrics.find(
                  (item) => item.ueId === ue.id,
                );
                return {
                  name: ue.id,
                  value: record && Number.isFinite(record[key]) ? Number(record[key].toFixed(1)) : null,
                  itemStyle: {
                    color: ue.id === ueId ? "#ffb32c" : "#1685ff",
                    borderRadius: [3, 3, 0, 0],
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
            height={110}
            className={className}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
