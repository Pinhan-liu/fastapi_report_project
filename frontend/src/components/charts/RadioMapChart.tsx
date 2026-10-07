import type { DashboardData, NetworkNode } from "../../types/backend";
import SpatialChart, { createProjection, SceneAxes, SceneNode } from "./SpatialChart";

const BANDS = [
  { label: "< −105", color: "#536aab" },
  { label: "−105～−95", color: "#648fc3" },
  { label: "−95～−85", color: "#6bb9cf" },
  { label: "−85～−75", color: "#72c9b6" },
  { label: "≥ −75", color: "#ade1ba" },
];
function color(value: number) { return BANDS[value < -105 ? 0 : value < -95 ? 1 : value < -85 ? 2 : value < -75 ? 3 : 4].color; }
export default function RadioMapChart({ data, ueId, focusedApId, onSelectUE, onFocusAP }: {
  data: DashboardData; ueId: string; focusedApId: string | null;
  onSelectUE: (id: string) => void; onFocusAP: (id: string) => void;
}) {
  const p = createProjection(data.area);
  function select(node: NetworkNode) { if (node.type === "ap") onFocusAP(node.id); else onSelectUE(node.id); }
  return <SpatialChart title="Radio Map / 采样网格" className="ain-radio-map"
    description={`${data.cells.length} 个有数据网格 · RSRP 均值 · ${data.gridSize}m 网格`}
    footer={<><div className="ain-spatial-key">{BANDS.map(b => <span key={b.label}><i style={{ background: b.color }} />{b.label} dBm</span>)}</div>
      <p>在所选时间段内，按 UE 的采样位置聚合。空白表示无采样，不代表信号为零；未做空间预测。</p>
      <p>节点位置为范围内最新时刻；网格为整个时间段的均值。</p>
      <p>热力接口：{data.apMeans.length} 个网格均值点（{data.gridSize}m 网格），覆盖 X 20–480m / Y 20–430m。</p>
      <p>网格值为对应区域 UE 的 RSRP 均值，非 AP 发射功率。</p></>}
  >{p && <svg className="ain-spatial-svg" viewBox="0 0 480 400" role="group" aria-label="UE 采样位置的 RSRP 网格图">
    <SceneAxes area={data.area} projection={p} />
    {data.cells.map(c => <rect key={`${c.x},${c.y}`} x={p.x(c.x)} y={p.y(c.y + data.gridSize)}
      width={p.x(c.x + data.gridSize) - p.x(c.x)} height={p.y(c.y) - p.y(c.y + data.gridSize)}
      fill={color(c.value)} opacity={0.8} stroke="#171d30" strokeWidth={0.35}>
      <title>{`X ${c.x}–${c.x + data.gridSize}m / Y ${c.y}–${c.y + data.gridSize}m：RSRP ${c.value.toFixed(1)} dBm；${c.count} 次采样`}</title>
    </rect>)}
    {data.nodes.map(node => <SceneNode key={node.id} node={node} projection={p}
      selected={node.type === "ue" ? node.id === ueId : node.id === focusedApId} onSelect={select} />)}
  </svg>}</SpatialChart>;
}
