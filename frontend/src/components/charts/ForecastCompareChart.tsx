import type { EChartsOption } from "echarts";
import type {
  ForecastResult,
  ForecastMetric,
} from "../../types/backend";
import ChartPanel, {
  AXIS_STYLE,
  CHART_BACKGROUND,
  CHART_FONT,
} from "./ChartPanel";
import "./ForecastCompareChart.css";

const METRICS: {
  key: ForecastMetric;
  label: string;
  unit: string;
}[] = [
  { key: "rsrp", label: "RSRP · 信号强度", unit: "dBm" },
  { key: "sinr", label: "SINR · 信号质量", unit: "dB" },
  { key: "throughput", label: "吞吐量", unit: "Mbps" },
];

function finiteValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

export default function ForecastCompareChart({
  forecast,
  pending,
  error,
}: {
  forecast: ForecastResult | null;
  pending: boolean;
  error: string;
}) {
  if (!forecast && !pending && !error) return null;
  
const hasValidForecast = Boolean(
  forecast?.ues.some((ue) =>
    METRICS.some((metric) => {
      const item = forecast.series[ue]?.[metric.key];

      return (
        finiteValue(item?.true_mean) !== null &&
        finiteValue(item?.pred_mean) !== null
      );
    })
  )
);

  return (
    <section
      className="ain-forecast-section"
      id="ain-forecast-result"
      aria-labelledby="ain-forecast-title"
    >
      <div className="ain-forecast-heading">
        <div>
          <h2 id="ain-forecast-title">历史预测效果对比</h2>
          <span className="ain-forecast-badge">历史回测</span>
        </div>

        <div
          className="ain-forecast-legend"
          aria-label="图表图例"
        >
          <span>
            <i className="is-true" />
            实测
          </span>
          <span>
            <i className="is-predicted" />
            预测
          </span>
        </div>
      </div>

      {pending ? (
        <p className="ain-forecast-state" role="status">
          正在获取预测对比数据…
        </p>
      ) : error ? (
        <p className="ain-forecast-error" role="alert">
          {error}
        </p>
      ) : (
        forecast && (
          <>          
           {!forecast.ues.length || !hasValidForecast ? (
             <p className="ain-forecast-state" role="status">
               当前时间范围的历史样本不足，无法生成有效的预测对比结果。
               建议选择1至2天的历史数据后重新加载。
             </p>
           ) : (

              <div className="ain-forecast-grid">
                {METRICS.map((metric) => {
                  const trueData = forecast.ues.map((ue) =>
                    finiteValue(
                      forecast.series[ue]?.[metric.key]?.true_mean,
                    ),
                  );

                  const predData = forecast.ues.map((ue) =>
                    finiteValue(
                      forecast.series[ue]?.[metric.key]?.pred_mean,
                    ),
                  );

                  const errors = forecast.ues
                    .map((ue) =>
                      finiteValue(
                        forecast.series[ue]?.[metric.key]?.mape,
                      ),
                    )
                    .filter(
                      (value): value is number => value !== null,
                    );

                  const average = errors.length
                    ? errors.reduce(
                        (sum, value) =>
                          sum + value / errors.length,
                        0,
                      )
                    : null;

                  const description =
                    average !== null && Number.isFinite(average)
                      ? `UE 均值对比 · 平均 MAPE ${average.toFixed(1)}%`
                      : "UE 均值对比 · 误差未返回";

                  const option: EChartsOption = {
                    animation: false,
                    backgroundColor: CHART_BACKGROUND,
                    textStyle: { fontFamily: CHART_FONT },
                    tooltip: {
                      trigger: "axis",
                      renderMode: "richText",
                      valueFormatter: (value: unknown) =>
                        `${value} ${metric.unit}`,
                    },
                    grid: {
                      left: 12,
                      right: 16,
                      top: 27,
                      bottom: 8,
                      containLabel: true,
                    },
                    xAxis: {
                      type: "category",
                      data: forecast.ues,
                      ...AXIS_STYLE,
                    },
                    yAxis: {
                      type: "value",
                      name: metric.unit,
                      nameTextStyle: {
                        color: "#c3d5ee",
                        fontSize: 11,
                        fontFamily: CHART_FONT,
                      },
                      ...AXIS_STYLE,
                    },
                    series: [
                      {
                        name: "实测",
                        type: "bar",
                        barMaxWidth: 22,
                        itemStyle: { color: "#ffb32c", borderRadius: 2 },
                        data: trueData,
                      },
                      {
                        name: "预测",
                        type: "bar",
                        barMaxWidth: 22,
                        itemStyle: { color: "#1685ff", borderRadius: 2 },
                        data: predData,
                      },
                    ],
                  };

                  return (
                    <ChartPanel
                      key={metric.key}
                      title={metric.label}
                      description={description}
                      option={option}
                      height={135}
                    />
                  );
                })}
              </div>
            )}

            <details className="ain-forecast-method">
              <summary>方法与数据范围</summary>
              <p>
                方法：{forecast.method} · 时间桶：
                {forecast.bin_size_min} 分钟
              </p>
              <p>
                场景：{forecast.scenario} ·{" "}
                {forecast.window_start} 至 {forecast.window_end}
                （北京时间）
              </p>
            </details>
          </>
        )
      )}
    </section>
  );
}