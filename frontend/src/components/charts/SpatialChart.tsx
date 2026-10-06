import type { ReactNode } from "react";
import type { DashboardData, NetworkNode } from "../../types/backend";
import "./SpatialCharts.css";

// 两张图共用场景坐标，X/Y 均为米；保持两个方向的比例一致。
export function createProjection(area: DashboardData["area"]) {
  const { width, height } = area;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return null;
  const scale = Math.min(400 / width, 300 / height);
  const left = 56 + (400 - width * scale) / 2;
  const top = 22 + (300 - height * scale) / 2;
  return {
    left,
    top,
    width: width * scale,
    height: height * scale,
    x: (value: number) => left + value * scale,
    y: (value: number) => top + (height - value) * scale,
    contains: (point: { x: number; y: number }) =>
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      point.x >= 0 &&
      point.x <= width &&
      point.y >= 0 &&
      point.y <= height,
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

export function SceneAxes({
  area,
  projection: p,
}: {
  area: DashboardData["area"];
  projection: Projection;
}) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
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
      {ticks.map((ratio) => (
        <g key={ratio}>
          <line
            x1={p.x(area.width * ratio)}
            y1={p.top}
            x2={p.x(area.width * ratio)}
            y2={p.top + p.height}
          />
          <line
            x1={p.left}
            y1={p.y(area.height * ratio)}
            x2={p.left + p.width}
            y2={p.y(area.height * ratio)}
          />
          <text
            x={p.x(area.width * ratio)}
            y={p.top + p.height + 22}
            textAnchor="middle"
          >
            {Math.round(area.width * ratio)}
          </text>
          <text
            x={p.left - 9}
            y={p.y(area.height * ratio) + 4}
            textAnchor="end"
          >
            {Math.round(area.height * ratio)}
          </text>
        </g>
      ))}
      <text x={p.left + p.width} y={p.top + p.height + 43} textAnchor="end">
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
  const color = selected ? "#efab65" : ap ? "#7ec7bc" : "#8eb8d0";
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
        <rect
          x={-10}
          y={-10}
          width={20}
          height={20}
          rx={3}
          fill={color}
          stroke="#171d30"
          strokeWidth={2}
        />
      ) : (
        <circle
          r={16}
          fill="none"
          stroke={color}
          strokeWidth={selected ? 3 : 1.5}
        />
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
