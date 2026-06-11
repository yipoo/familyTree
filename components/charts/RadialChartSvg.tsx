import Link from "next/link";

import type { RadialChart } from "@/lib/services/radial-chart";

const GENDER_FILL: Record<string, string> = {
  MALE: "#2563eb",
  FEMALE: "#db2777",
  UNKNOWN: "#6b7280",
};

/**
 * 族谱圆（同心圆世系图）SVG 渲染。
 * 背景环 + 辐射连线 + 人物节点；点击任一人将其设为新圆心重绘。
 */
export function RadialChartSvg({
  chart,
  familyId,
}: {
  chart: RadialChart;
  familyId: string;
}) {
  const { size, center } = chart;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      className="mx-auto block max-w-[min(92vh,1200px)]"
      role="img"
      aria-label={`${chart.rootName} 族谱圆`}
    >
      {/* 背景环 */}
      {chart.rings.map((r, i) => (
        <circle
          key={i}
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={1}
        />
      ))}

      {/* 连线 */}
      <g stroke="currentColor" strokeOpacity={0.28} strokeWidth={1}>
        {chart.links.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
        ))}
      </g>

      {/* 节点 */}
      {chart.nodes.map((n) => {
        const isRoot = n.depth === 0;
        const r = isRoot ? 8 : 4.5;
        const right = n.x >= center;
        const labelX = isRoot ? n.x : n.x + (right ? 8 : -8);
        const labelY = isRoot ? n.y + 20 : n.y;
        const anchor = isRoot ? "middle" : right ? "start" : "end";
        return (
          <Link key={n.id} href={`/f/${familyId}/circle?root=${n.id}`}>
            <g className="cursor-pointer">
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill={isRoot ? "#b45309" : GENDER_FILL[n.gender] ?? GENDER_FILL.UNKNOWN}
                stroke="var(--color-panel, #fff)"
                strokeWidth={1.5}
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={isRoot ? 13 : 9.5}
                fontWeight={isRoot ? 700 : 400}
                fill="currentColor"
              >
                {n.name}
              </text>
            </g>
          </Link>
        );
      })}
    </svg>
  );
}
