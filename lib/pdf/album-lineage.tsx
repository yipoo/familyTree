/**
 * 册谱合编本「世系图录」用的吊线图——react-pdf 版，缩放填入 A4 竖版正文区。
 *
 * 与独立吊线图 PDF（lib/pdf/lineage-chart.tsx，A3 横版整页）区别：
 *   - 这里返回的是可嵌入册谱 <Page> 的 <Svg>（不含 Document/Page），按给定
 *     内容宽高把整图等比缩放进去（用户选择「缩到 A4 竖版内」）。
 *   - 消费同一份 lib/services/lineage-chart.ts 的 LineageChartLayout。
 *
 * 仅服务端使用（react-pdf Node 渲染）。
 */
import * as React from "react";
import { Svg, G, Rect, Line as PdfLine, Text as PdfText } from "@react-pdf/renderer";

import type { LineageChartLayout } from "@/lib/services/lineage-chart";

const GEN_COL_W = 28;

export function AlbumLineageChart({
  layout,
  generationChars,
  fontFamily,
  contentW,
  contentH,
}: {
  layout: LineageChartLayout;
  generationChars: Record<string, string>;
  fontFamily: string;
  /** 可用内容宽（A4 竖版去边距，约 483pt） */
  contentW: number;
  /** 可用内容高（去标题/页脚，约 640pt） */
  contentH: number;
}) {
  const usableW = contentW - GEN_COL_W;
  const scale = Math.min(
    usableW / Math.max(layout.width, 1),
    contentH / Math.max(layout.height, 1),
    1,
  );

  return (
    <Svg width={contentW} height={contentH} viewBox={`0 0 ${contentW} ${contentH}`}>
      {/* 世代列标 */}
      {layout.generations.map((g) => {
        const ch = generationChars[String(g)] ?? "";
        const cy = (layout.yByGen[g] ?? 0) * scale + 12;
        return (
          <React.Fragment key={`gen-${g}`}>
            <PdfText x={2} y={cy} style={{ fontSize: 7, fontFamily }} fill="#64748b">
              {`${g} 世`}
            </PdfText>
            {ch && (
              <PdfText
                x={2}
                y={cy + 11}
                style={{ fontSize: 10, fontWeight: 700, fontFamily }}
                fill="#0f172a"
              >
                {ch}
              </PdfText>
            )}
          </React.Fragment>
        );
      })}

      {/* 整图按 scale 缩放 */}
      <G transform={`translate(${GEN_COL_W}, 0) scale(${scale})`}>
        {layout.lines.map((l, i) => (
          <PdfLine
            key={`l${i}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="#94a3b8"
            strokeWidth={1.2}
          />
        ))}
        {layout.nodes.map((n) => {
          const dec = n.person.status === "DECEASED";
          return (
            <React.Fragment key={n.id}>
              <Rect
                x={n.x}
                y={n.y}
                width={n.width}
                height={n.height}
                rx={3}
                ry={3}
                fill={dec ? "#f1f5f9" : "#ffffff"}
                stroke={dec ? "#94a3b8" : "#475569"}
                strokeWidth={1}
              />
              <PdfText
                x={n.x + n.width / 2}
                y={n.y + n.height / 2 + 1}
                style={{ fontSize: 11, fontWeight: 700, fontFamily }}
                textAnchor="middle"
                fill="#0f172a"
              >
                {n.person.name}
                {dec ? "†" : ""}
              </PdfText>
              <PdfText
                x={n.x + n.width / 2}
                y={n.y + n.height / 2 + 14}
                style={{ fontSize: 7, fontFamily }}
                textAnchor="middle"
                fill="#64748b"
              >
                {(n.person.generationChar ?? "") +
                  (n.person.birthYear ? `·${n.person.birthYear}` : "") +
                  (n.spouses.length > 0
                    ? `·配${n.spouses.map((s) => s.name).join("/")}`
                    : "")}
              </PdfText>
            </React.Fragment>
          );
        })}
      </G>
    </Svg>
  );
}
