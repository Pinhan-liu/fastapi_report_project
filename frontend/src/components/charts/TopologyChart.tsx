import type { DashboardData, NetworkNode } from "../../types/backend";
import SpatialChart, {
  createProjection,
  SceneAxes,
  SceneNode,
} from "./SpatialChart";

interface Props {
  data: DashboardData;
  ueId: string;
  focusedApId: string | null;
  onSelectUE: (id: string) => void;
  onFocusAP: (id: string) => void;
}
export default function TopologyChart({
  data,
  ueId,
  focusedApId,
  onSelectUE,
  onFocusAP,
}: Props) {
  const projection = createProjection(data.area);
  const nodes = data.nodes.filter((node) => projection?.contains(node));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links = data.links.filter(
    (link) =>
      byId.get(link.source)?.type === "ap" &&
      byId.get(link.target)?.type === "ue",
  );
  const highlighted = new Set(
    links
      .filter((link) =>
        focusedApId ? link.source === focusedApId : link.target === ueId,
      )
      .flatMap((link) => [link.source, link.target]),
  );
  const selectNode = (node: NetworkNode) => {
    if (node.type === "ue") onSelectUE(node.id);
    else onFocusAP(node.id);
  };
  return (
    <SpatialChart
      title="网络拓扑"
      className="ain-topology-chart"
      description={`${nodes.length} 个有效节点 / ${links.length} 条服务连接`}
      footer={
        <>
          <div className="ain-spatial-key">
            <span>
              <i className="ain-key-ap" />
              AP
            </span>
            <span>
              <i className="ain-key-ue" />
              UE
            </span>
            <span>
              <i className="ain-key-selected" />
              当前选择
            </span>
          </div>
          <p>
            {focusedApId
              ? `关注 ${focusedApId}：高亮其服务连接。`
              : `分析 ${ueId || "未选择对象"}：高亮其服务连接。`}
          </p>
          <p>点击 AP 查看连接；点击 UE 查看指标。连线为窗口内该 UE 主服务 AP（连接占比最高）。采样时刻：{data.metrics.at(-1)?.backendTime}（北京时间）。</p>
          {links.length < data.links.length && (
            <p>
              {data.links.length - links.length}{" "}
              条连接因端点缺失、类型无效或越界未绘制。
            </p>
          )}
          {nodes.length < data.nodes.length && <p>无效或越界节点未绘制。</p>}
        </>
      }
    >
      {projection ? (
        <svg
          className="ain-spatial-svg"
          viewBox="0 0 480 400"
          role="group"
          aria-label="AP 与 UE 服务连接拓扑图"
        >
          <SceneAxes area={data.area} projection={projection} />
          {links.map((link) => {
            const source = byId.get(link.source)!;
            const target = byId.get(link.target)!;
            const active = focusedApId
              ? link.source === focusedApId
              : link.target === ueId;
            const midX = (projection.x(source.x) + projection.x(target.x)) / 2;
            const midY = (projection.y(source.y) + projection.y(target.y)) / 2;
            return (
              <g key={link.id}>
                <line
                  className={`ain-topology-link${active ? " is-active" : ""}`}
                  x1={projection.x(source.x)}
                  y1={projection.y(source.y)}
                  x2={projection.x(target.x)}
                  y2={projection.y(target.y)}
                >
                  <title>{`${source.id} → ${target.id}：RSRP ${link.rsrp} dBm / SINR ${link.sinr} dB / 吞吐量 ${link.throughput} Mbps（窗口内主服务连接）`}</title>
                </line>
                <text
                  className="ain-topology-weight"
                  x={midX}
                  y={midY - 3}
                  textAnchor="middle"
                >
                  {link.rsrp.toFixed(1)}
                </text>
              </g>
            );
          })}
          {nodes.map((node) => (
            <SceneNode
              key={node.id}
              node={node}
              projection={projection}
              selected={
                node.type === "ue" ? node.id === ueId : node.id === focusedApId
              }
              highlighted={highlighted.has(node.id)}
              onSelect={selectNode}
            />
          ))}
          {!nodes.length && (
            <text
              x={256}
              y={180}
              textAnchor="middle"
              fill="#b5c7d5"
              fontSize={15}
            >
              暂无网络节点
            </text>
          )}
        </svg>
      ) : (
        <p className="ain-spatial-empty">场景尺寸无效，无法绘制拓扑图。</p>
      )}
    </SpatialChart>
  );
}
