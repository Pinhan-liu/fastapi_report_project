import type {
  DashboardData,
  MetricKey,
} from "../../types/backend";
import { METRIC_META } from "../../types/backend";
import {
  getLatestFrame,
  displayMetric,
} from "../../services/metrics";
import "./ChartPanel.css";

const MAIN_KEYS: MetricKey[] = [
  "rsrpDbm",
  "sinrDb",
  "throughputMbps",
  "latencyMs",
];

const EXTRA_KEYS: MetricKey[] = [
  "packetLossPct",
  "retransmissions",
  "demandMbps",
  "resourceUtilizationPct",
];

export default function KpiSummary({
  data,
  ueId,
}: {
  data: DashboardData;
  ueId: string;
}) {
  const frame = getLatestFrame(data.metrics);

  const latest = frame.metrics.find(
    record => record.ueId === ueId,
  );

  const sampleTime = frame.timestamp
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(frame.timestamp))
    : "暂无";

  const hasDemand =
    latest &&
    Number.isFinite(latest.demandMbps) &&
    Number.isFinite(latest.throughputMbps);

  const belowDemand =
    hasDemand &&
    latest.throughputMbps < latest.demandMbps;

  return (
    <section className="ain-summary-slot">
      <div className="ain-kpi-heading">
        <h2>核心指标 / {ueId || "未选择对象"}</h2>

        <span>
          最新采样 {sampleTime} ·{" "}
          {latest ? "当前对象有数据" : "当前对象暂无数据"}
        </span>
      </div>

      <div className="ain-kpi-grid">
        {MAIN_KEYS.map(key => {
          const hasValue = Number.isFinite(latest?.[key]);

          const warning =
            key === "throughputMbps" && Boolean(belowDemand);

          return (
            <article
              key={key}
              data-kpi={key}
              className={`ain-kpi-card${
                warning ? " ain-kpi-warning" : ""
              }`}
            >
              <div className="ain-kpi-title-row">
                <p className="ain-kpi-label">
                  {METRIC_META[key].label}
                </p>

                <span
                  className="ain-kpi-status"
                  data-tone={warning ? "warning" : "neutral"}
                >
                  {!hasValue
                    ? "暂无值"
                    : warning
                      ? "低于需求"
                      : "观测值"}
                </span>
              </div>

              <div>
                <strong className="ain-kpi-value">
                  {displayMetric(latest?.[key])}
                </strong>

                <span className="ain-kpi-unit">
                  {METRIC_META[key].unit}
                </span>
              </div>

              <p className="ain-kpi-note">
                {key === "throughputMbps" && hasDemand
                  ? `${
                      belowDemand ? "低于" : "达到"
                    }当前业务需求 ${latest.demandMbps} Mbps`
                  : hasValue
                    ? "当前采样值 · 未提供单项异常判定"
                    : "该指标暂无有效采样值"}
              </p>
            </article>
          );
        })}
      </div>

      <div className="ain-extra-metrics">
        {EXTRA_KEYS.map(key => (
          <span key={key}>
            {METRIC_META[key].label}：
            <strong>{displayMetric(latest?.[key])}</strong>{" "}
            {METRIC_META[key].unit}
          </span>
        ))}
      </div>

      <p className="ain-kpi-scope-note">
        这里展示当前 UE 的最新采样；
        AP 在整个时段的异常证据见下方研判模块。
      </p>
    </section>
  );
}