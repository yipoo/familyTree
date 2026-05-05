/**
 * 吊线图 SVG 渲染组件（纯展示，无交互）。
 *
 * 服务端 / 客户端均可使用：仅依赖布局结果，输出 <svg>。
 * 用作页面预览 + 打印 PDF。
 */
import type { LineageChartLayout } from "@/lib/services/lineage-chart";

export interface LineageChartSvgProps {
  layout: LineageChartLayout;
  /** 家族名 / 标题（顶部） */
  title: string;
  /** 副标题，如"由 XXX 至今 N 代" */
  subtitle?: string;
  /** 字辈表 generation→char */
  generationChars: Record<string, string>;
  /** 是否在节点旁标记字辈 */
  showGenerationChar?: boolean;
}

const FONT_SIZE_NAME = 14;
const FONT_SIZE_SUB = 10;
const COLOR_TEXT = "#0f172a";
const COLOR_TEXT_MUTED = "#64748b";
const COLOR_LINE = "#94a3b8";
const COLOR_BOX = "#ffffff";
const COLOR_BOX_BORDER = "#475569";
const COLOR_BOX_DECEASED = "#f1f5f9";
const COLOR_BOX_BORDER_DECEASED = "#94a3b8";

export function LineageChartSvg({
  layout,
  title,
  subtitle,
  generationChars,
  showGenerationChar = true,
}: LineageChartSvgProps) {
  const headerH = subtitle ? 70 : 44;
  const genCol = 28;
  const w = layout.width + genCol;
  const h = layout.height + headerH;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ background: "#ffffff", fontFamily: "system-ui, sans-serif" }}
    >
      {/* 标题 */}
      <text
        x={w / 2}
        y={26}
        textAnchor="middle"
        fontSize={20}
        fontWeight={600}
        fill={COLOR_TEXT}
      >
        {title}
      </text>
      {subtitle && (
        <text
          x={w / 2}
          y={50}
          textAnchor="middle"
          fontSize={12}
          fill={COLOR_TEXT_MUTED}
        >
          {subtitle}
        </text>
      )}

      {/* 左侧世代标识 */}
      {layout.generations.map((g) => {
        const ch = generationChars[String(g)] ?? "";
        return (
          <g key={`gen-${g}`} transform={`translate(${10}, ${headerH + (layout.yByGen[g] ?? 0) + 20})`}>
            <text fontSize={FONT_SIZE_SUB} fill={COLOR_TEXT_MUTED} y={-4}>
              {g} 世
            </text>
            {ch && (
              <text fontSize={FONT_SIZE_NAME} fontWeight={600} fill={COLOR_TEXT} y={14}>
                {ch}
              </text>
            )}
          </g>
        );
      })}

      <g transform={`translate(${genCol}, ${headerH})`}>
        {/* 连线 */}
        {layout.lines.map((l, i) => (
          <line
            key={`l${i}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={COLOR_LINE}
            strokeWidth={1.2}
          />
        ))}

        {/* 节点 */}
        {layout.nodes.map((n) => {
          const dec = n.person.status === "DECEASED";
          const fill = dec ? COLOR_BOX_DECEASED : COLOR_BOX;
          const stroke = dec ? COLOR_BOX_BORDER_DECEASED : COLOR_BOX_BORDER;
          return (
            <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
              <rect
                width={n.width}
                height={n.height}
                rx={3}
                ry={3}
                fill={fill}
                stroke={stroke}
                strokeWidth={1}
              />
              <text
                x={n.width / 2}
                y={n.height / 2 - 2}
                textAnchor="middle"
                fontSize={FONT_SIZE_NAME}
                fontWeight={600}
                fill={COLOR_TEXT}
              >
                {n.person.name}
                {dec ? "†" : ""}
              </text>
              <text
                x={n.width / 2}
                y={n.height / 2 + 13}
                textAnchor="middle"
                fontSize={FONT_SIZE_SUB}
                fill={COLOR_TEXT_MUTED}
              >
                {showGenerationChar && n.person.generationChar
                  ? n.person.generationChar
                  : ""}
                {n.person.birthYear ? `·${n.person.birthYear}` : ""}
                {n.spouses.length > 0
                  ? `·配${n.spouses.map((s) => s.name).join("/")}`
                  : ""}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
