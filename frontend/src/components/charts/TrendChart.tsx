import type { EChartsOption } from "echarts";
import type { DashboardData, MetricKey } from "../../types/backend";
import { METRIC_META } from "../../types/backend";
import { getUEHistory, displayMetric } from "../../services/metrics";
import ChartPanel, { AXIS_STYLE, CHART_BACKGROUND } from "./ChartPanel";

const ITEMS: { key: MetricKey; title: string; className: string }[] = [
  {
    key: "throughputMbps",
    title: "吞吐量趋势",
    className: "ain-trend-throughput",
  },
  { key: "sinrDb", title: "SINR 趋势", className: "ain-trend-sinr" },
  { key: "latencyMs", title: "时延趋势", className: "ain-trend-latency" },
];
const clock = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export default function TrendChart({
  data,
  ueId,
}: {
  data: DashboardData;
  ueId: string;
}) {
  const history = getUEHistory(data.metrics, ueId);
  return (
    <section className="ain-trend-section">
      <div className="ain-trend-heading">
        <h2>指标时间趋势 / {ueId || "未选择对象"}</h2>
        <p>{history.length} 个历史时刻 · 北京时间 · 历史展示</p>
      </div>
      <div className="ain-trend-grid">
        {ITEMS.map(({ key, title, className }) => {
          const unit = METRIC_META[key].unit;
          const option: EChartsOption = {
            animation: false,
            backgroundColor: CHART_BACKGROUND,
            grid: { left: 40, right: 25, top: 23, bottom: 30 },
            tooltip: {
              trigger: "axis",
              renderMode: "richText",
              formatter: (params: unknown) => {
                const first = (Array.isArray(params) ? params[0] : params) as
                  { value?: unknown } | undefined;
                const value = first?.value;
                if (!Array.isArray(value) || value.length < 2)
                  return "暂无数据";
                const metric = typeof value[1] === "number" && Number.isFinite(value[1])
                  ? `${value[1].toFixed(1)} ${unit}` : "暂无数据";
                return `${ueId} / ${clock.format(new Date(Number(value[0])))}（北京时间）\n${title}：${metric}`;
              },
            },
            xAxis: {
              ...AXIS_STYLE,
              type: "time",
              splitNumber: 3,
              axisLabel: {
                ...AXIS_STYLE.axisLabel,
                formatter: (value: number) => clock.format(new Date(value)),
                hideOverlap: true,
              },
            },
            yAxis: {
              ...AXIS_STYLE,
              type: "value",
              min: key === "sinrDb" ? undefined : 0,
              splitNumber: 3,
            },
            series: [
              {
                name: title,
                type: "line",
                symbolSize: 6,
                smooth: false,
                connectNulls: false,
                itemStyle: { color: "#69bed1" },
                lineStyle: { width: 2 },
                label: {
                  show: true,
                  position: "top",
                  color: "#cae7ee",
                  fontSize: 10,
                  formatter: (params) =>
                    params.dataIndex === history.length - 1
                      ? displayMetric(history.at(-1)?.[key])
                      : "",
                },
                data: history.map((record) => [
                  Date.parse(record.timestamp),
                  Number.isFinite(record[key]) ? record[key] : null,
                ]),
              },
            ],
          };
          return (
            <ChartPanel
              key={key}
              title={title}
              description={`${unit} · ${history.length ? "实际采样间隔" : "暂无历史数据"}`}
              option={option}
              height={190}
              className={className}
            />
          );
        })}
      </div>
    </section>
  );
}
