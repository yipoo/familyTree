/**
 * 迁徙脉络 SVG（服务端可渲染，无交互）。
 * 消费 lib/services/migration-map.ts 的 FlowLayout：
 * 地点为圆角矩形节点（地名 + 现居人数），迁徙为带箭头曲线（上注主体、下注事由）。
 * 视窗自适应：width=100% + viewBox（同吊线图做法），打印时按版面缩放。
 */
import * as React from "react";

import {
  FLOW_NODE_W as W,
  FLOW_NODE_H as H,
  type FlowLayout,
} from "@/lib/services/migration-map";

const PAD = 20;

export function MigrationFlowSvg({ layout }: { layout: FlowLayout }) {
  const vw = layout.width + PAD * 2;
  const vh = layout.height + PAD * 2;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="xMidYMin meet"
      style={{
        background: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        maxHeight: "70vh",
        height: "auto",
        display: "block",
      }}
    >
      <defs>
        <marker
          id="mig-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b" />
        </marker>
      </defs>

      <g transform={`translate(${PAD}, ${PAD})`}>
        {/* 迁徙边：from 右中 → to 左中，水平三次贝塞尔；中点上下注 主体/事由 */}
        {layout.edges.map((e, i) => {
          const x1 = e.from.x + W;
          const y1 = e.from.y + H / 2;
          const x2 = e.to.x;
          const y2 = e.to.y + H / 2;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          return (
            <g key={i}>
              <path
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.6}
                markerEnd="url(#mig-arrow)"
              />
              <text x={mx} y={my - 7} textAnchor="middle" fontSize={11} fill="#475569">
                {e.subject}
              </text>
              <text x={mx} y={my + 13} textAnchor="middle" fontSize={10} fill="#94a3b8">
                {e.label}
              </text>
            </g>
          );
        })}

        {/* 地点节点 */}
        {layout.nodes.map((n) => (
          <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
            <rect
              width={W}
              height={H}
              rx={8}
              ry={8}
              fill="#ffffff"
              stroke="#475569"
              strokeWidth={1.2}
            />
            <text
              x={W / 2}
              y={n.count > 0 ? 24 : H / 2 + 5}
              textAnchor="middle"
              fontSize={14}
              fontWeight={600}
              fill="#0f172a"
            >
              {n.name}
            </text>
            {n.count > 0 && (
              <text x={W / 2} y={42} textAnchor="middle" fontSize={11} fill="#64748b">
                现居 {n.count} 人
              </text>
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}
