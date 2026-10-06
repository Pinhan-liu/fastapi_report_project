import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, HeatmapChart, GraphChart } from "echarts/charts";
import { GridComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import "./ChartPanel.css";

echarts.use([
  BarChart,
  LineChart,
  HeatmapChart,
  GraphChart,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  SVGRenderer,
]);

interface Props {
  title: string;
  description: string;
  option: EChartsOption;
  height?: number;
  className?: string;
  onSelect?: (ueId: string) => void;
}
export default function ChartPanel({
  title,
  description,
  option,
  height = 190,
  className = "",
  onSelect,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<ReturnType<typeof echarts.init> | null>(null);
  useEffect(() => {
    if (!container.current) return;
    const instance = echarts.init(container.current, null, { renderer: "svg" });
    chart.current = instance;
    const observer = new ResizeObserver(() => {
      const element = container.current;
      if (!instance.isDisposed() && element?.isConnected && element.clientWidth > 0 && element.clientHeight > 0)
        instance.resize();
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);
  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true });
  }, [option]);
  useEffect(() => {
    const instance = chart.current;
    if (!instance || !onSelect) return;
    const handleClick = (event: { name?: string }) => {
      if (event.name) onSelect(event.name);
    };
    instance.on("click", "series.bar", handleClick);
    return () => {
      if (!instance.isDisposed()) instance.off("click", handleClick);
    };
  }, [onSelect]);
  return (
    <figure className={`ain-chart-slot ain-real-chart ${className}`}>
      <figcaption className="ain-slot-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </figcaption>
      <div
        ref={container}
        className="ain-echart"
        style={{ height }}
        role="img"
        aria-label={`${title}：${description}`}
      />
    </figure>
  );
}
export const AXIS_STYLE = {
  axisLine: { lineStyle: { color: "#526479" } },
  axisLabel: { color: "#b5c7d5", fontSize: 10 },
  splitLine: { lineStyle: { color: "#2a3449" } },
};
export const CHART_BACKGROUND = "#171d30";
