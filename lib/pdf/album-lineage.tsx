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

// ── 竖排吊线图（仿 1995 谱：竖排名字、无框、细线）──

import {
  V_CHAR_H,
  type VerticalLayout,
} from "@/lib/services/lineage-chunks";

const V_GEN_COL = 34;
const V_PAD = 6;

/**
 * 竖排吊线图（react-pdf 版）：与屏幕端 components/album/VerticalLineageSvg 消费
 * 同一份 VerticalLayout。名字逐字纵排（react-pdf 无 writing-mode），整图等比缩入
 * 给定内容区。
 */
export function AlbumVerticalLineage({
  layout,
  generationChars,
  fontFamily,
  contentW,
  contentH,
}: {
  layout: VerticalLayout;
  generationChars: Record<string, string>;
  fontFamily: string;
  contentW: number;
  contentH: number;
}) {
  const vw = layout.width + V_GEN_COL + V_PAD * 2;
  const vh = layout.height + V_PAD * 2;
  const scale = Math.min(contentW / vw, contentH / vh, 1);
  const firstGen = layout.startGen;
  const rowH = layout.rows > 0 ? layout.height / layout.rows : 0;
  // 居中放置
  const offX = (contentW - vw * scale) / 2;

  return (
    <Svg width={contentW} height={contentH} viewBox={`0 0 ${contentW} ${contentH}`}>
      <G transform={`translate(${offX + V_PAD * scale}, ${V_PAD * scale}) scale(${scale})`}>
        {Array.from({ length: layout.rows }, (_, r) => {
          const gen = firstGen + r;
          const ch = generationChars[String(gen)];
          return (
            <PdfText
              key={`g${r}`}
              x={2}
              y={r * rowH + 11}
              style={{ fontSize: 8, fontFamily }}
              fill="#a1a1aa"
            >
              {`${gen}世${ch ? `·${ch}` : ""}`}
            </PdfText>
          );
        })}
        <G transform={`translate(${V_GEN_COL}, 0)`}>
          {layout.links.map((l, i) => (
            <PdfLine
              key={`l${i}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="#52525b"
              strokeWidth={0.9}
            />
          ))}
          {layout.nodes.map((n) => (
            <React.Fragment key={n.id}>
              {Array.from(n.name).map((ch, i) => (
                <PdfText
                  key={i}
                  x={n.x}
                  y={n.y + (i + 1) * V_CHAR_H - 3}
                  style={{ fontSize: 12, fontFamily }}
                  textAnchor="middle"
                  fill="#18181b"
                >
                  {ch}
                </PdfText>
              ))}
            </React.Fragment>
          ))}
        </G>
      </G>
    </Svg>
  );
}
