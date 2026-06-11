/**
 * 竖排吊线图（屏幕/打印端，仿 1995 四修谱世系图版式）：
 * 名字竖排、无外框，父子以细吊线相连（线长随名长与分支自然伸展），
 * 左侧世代标尺。消费 lib/services/lineage-chunks.ts 的 VerticalLayout，
 * 与 PDF 端（lib/pdf/album-lineage.tsx）同一布局数据。
 */
import * as React from "react";

import {
  V_CHAR_H,
  V_NAME_MAX,
  type VerticalLayout,
} from "@/lib/services/lineage-chunks";

const GEN_COL = 34;
const PAD = 6;

export function VerticalLineageSvg({
  layout,
  generationChars,
  fit = "contain",
}: {
  layout: VerticalLayout;
  generationChars: Record<string, string>;
  /** contain：等比缩入父容器（册谱页堆叠）；width：宽度自适应 */
  fit?: "contain" | "width";
}) {
  const vw = layout.width + GEN_COL + PAD * 2;
  const vh = layout.height + PAD * 2;
  const firstGen = layout.nodes[0]?.generation ?? 1;
  const rowH = layout.rows > 0 ? layout.height / layout.rows : 0;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid meet"
      style={
        fit === "contain"
          ? { width: "100%", height: "100%", display: "block", fontFamily: "var(--font-serif), serif" }
          : { maxHeight: "85vh", height: "auto", display: "block", fontFamily: "var(--font-serif), serif" }
      }
    >
      <g transform={`translate(${PAD}, ${PAD})`}>
        {/* 世代标尺 */}
        {Array.from({ length: layout.rows }, (_, r) => {
          const gen = firstGen + r;
          const ch = generationChars[String(gen)];
          return (
            <text
              key={r}
              x={2}
              y={r * rowH + 12}
              fontSize={9}
              fill="#a1a1aa"
            >
              {gen}世{ch ? `·${ch}` : ""}
            </text>
          );
        })}

        <g transform={`translate(${GEN_COL}, 0)`}>
          {/* 吊线（细线，无框） */}
          {layout.links.map((l, i) => (
            <line
              key={i}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="#52525b"
              strokeWidth={0.9}
            />
          ))}

          {/* 竖排名字（逐字 tspan，无框线） */}
          {layout.nodes.map((n) => (
            <text
              key={n.id}
              x={n.x}
              y={n.y}
              textAnchor="middle"
              fontSize={13}
              fill="#18181b"
            >
              {Array.from(n.name).map((ch, i) => (
                <tspan key={i} x={n.x} dy={i === 0 ? V_CHAR_H - 2 : V_CHAR_H}>
                  {ch}
                </tspan>
              ))}
              {n.isContinuation && (
                <tspan
                  x={n.x}
                  dy={V_CHAR_H}
                  fontSize={9}
                  fill="#a1a1aa"
                >
                  ⋮
                </tspan>
              )}
            </text>
          ))}
        </g>
      </g>
    </svg>
  );
}

/** 估算一块竖排图的纵横比，供页面按比例分配堆叠高度。 */
export function verticalAspect(layout: VerticalLayout): number {
  return (layout.height + PAD * 2) / (layout.width + GEN_COL + PAD * 2);
}

export { V_NAME_MAX };
