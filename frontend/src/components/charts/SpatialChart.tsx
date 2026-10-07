import type { ReactNode } from "react";
import type { DashboardData, NetworkNode } from "../../types/backend";
import "./SpatialCharts.css";

// 两张图共用场景坐标，X/Y 均为米；保持两个方向的比例一致。
// area 取数据实际范围（min~max），坐标系直接贴合数据分布，不留零起点空白。
// 图框尽量撑满画布，四周只留刻度标签所需的最小空间，两张图完全同尺寸对齐。
export function createProjection(area: DashboardData["area"]) {
  const { xMin, yMin, xMax, yMax } = area;
  const width = xMax - xMin;
  const height = yMax - yMin;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return null;
  // viewBox 480x400：左侧留 Y 轴刻度、右侧留轴名、顶部留 Y/m、底部留 X 刻度与 X/m
  // 图框整体偏左下放置，避免视觉重心偏右上
  const maxW = 480 - 56 - 24;
  const maxH = 400 - 37 - 60;
  const scale = Math.min(maxW / width, maxH / height);
  const left = 56 + (maxW - width * scale) / 2;
  const top = 37 + (maxH - height * scale) / 2;
  return {
    left,
    top,
    width: width * scale,
    height: height * scale,
    x: (value: number) => left + (value - xMin) * scale,
    y: (value: number) => top + (yMax - value) * scale,
    contains: (point: { x: number; y: number }) =>
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      point.x >= xMin &&
      point.x <= xMax &&
      point.y >= yMin &&
      point.y <= yMax,
  };
}
export type Projection = NonNullable<ReturnType<typeof createProjection>>;

export const SIGNAL_BANDS = [
  { label: "< −90", color: "#526aab" },
  { label: "−90～−80", color: "#648fc3" },
  { label: "−80～−70", color: "#6bb9cf" },
  { label: "−70～−60", color: "#72c9b6" },
  { label: "≥ −60", color: "#ade1ba" },
];
export function signalColor(value: number) {
  const index =
    value < -90 ? 0 : value < -80 ? 1 : value < -70 ? 2 : value < -60 ? 3 : 4;
  return SIGNAL_BANDS[index].color;
}

// 圆整步长刻度：只取 1/2/5 × 10^n 的步长，刻度值整齐（如 100/200/300）
function niceStep(rough: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
}
function buildTicks(min: number, max: number, count = 4): number[] {
  const span = max - min;
  if (span <= 0) return [min];
  const step = niceStep(span / count);
  const first = Math.ceil(min / step) * step;
  const last = Math.floor(max / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= last + 1e-9; v += step) ticks.push(v);
  return ticks.length ? ticks : [min];
}

export function SceneAxes({
  area,
  projection: p,
}: {
  area: DashboardData["area"];
  projection: Projection;
}) {
  const xTicks = buildTicks(area.xMin, area.xMax);
  const yTicks = buildTicks(area.yMin, area.yMax);
  return (
    <g className="ain-scene-axes" aria-hidden="true">
      <rect
        x={p.left}
        y={p.top}
        width={p.width}
        height={p.height}
        fill="none"
        stroke="#526479"
      />
      {xTicks.map((value) => (
        <g key={`x${value}`}>
          <line
            x1={p.x(value)}
            y1={p.top}
            x2={p.x(value)}
            y2={p.top + p.height}
          />
          <text x={p.x(value)} y={p.top + p.height + 22} textAnchor="middle">
            {value}
          </text>
        </g>
      ))}
      {yTicks.map((value) => (
        <g key={`y${value}`}>
          <line
            x1={p.left}
            y1={p.y(value)}
            x2={p.left + p.width}
            y2={p.y(value)}
          />
          <text x={p.left - 9} y={p.y(value) + 4} textAnchor="end">
            {value}
          </text>
        </g>
      ))}
      <text x={p.left + p.width + 14} y={p.top + p.height + 43} textAnchor="start">
        X / m
      </text>
      <text x={p.left - 8} y={p.top - 8} textAnchor="end">
        Y / m
      </text>
    </g>
  );
}

export function SceneNode({
  node,
  projection,
  selected,
  highlighted = false,
  onSelect,
}: {
  node: NetworkNode;
  projection: Projection;
  selected: boolean;
  highlighted?: boolean;
  onSelect: (node: NetworkNode) => void;
}) {
  const ap = node.type === "ap";
  const color = selected ? "#efab65" : ap ? "#e74c3c" : "#2ecc71";
  return (
    <g
      className={`ain-scene-node${selected ? " is-selected" : ""}`}
      transform={`translate(${projection.x(node.x)} ${projection.y(node.y)})`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={ap ? `关注 ${node.id} 的服务连接` : `选择 ${node.id}`}
      onClick={() => onSelect(node)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(node);
        }
      }}
    >
      <title>{`${node.id} · (${node.x}, ${node.y}) m`}</title>
      <circle className="ain-node-hit-area" r={23} fill="transparent" />
      {ap ? (
        <polygon
          points="0,-12 10,10 -10,10"
          fill={color}
          stroke="#171d30"
          strokeWidth={2}
        />
      ) : (
        <circle r={8} fill={color} stroke="#171d30" strokeWidth={2} />
      )}
      {(selected || highlighted) && (
        <circle
          r={22}
          fill="none"
          stroke={selected ? "#efab65" : "#7ec7bc"}
          strokeWidth={1.5}
        />
      )}
      <text y={-27} textAnchor="middle" fill={color}>
        {node.id}
      </text>
    </g>
  );
}

export default function SpatialChart({
  title,
  description,
  className,
  children,
  footer,
}: {
  title: string;
  description: string;
  className: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section className={`ain-chart-slot ain-spatial-chart ${className}`}>
      <div className="ain-slot-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="ain-spatial-stage">{children}</div>
      <div className="ain-spatial-footer">{footer}</div>
    </section>
  );
}
