/**
 * 用 @react-pdf/renderer 渲染吊线图 PDF。
 *
 * 使用 react-pdf 的 SVG 原语（Svg / Rect / Line / Text）。
 * 自动按页缩放：以 A3 横版为基准，超大图按比例缩到 1 页（保持完整）。
 *
 * 仅服务端使用：依赖 react-pdf 的 Node 端二进制（pdfkit）。
 */
import * as React from "react";
import {
  Document,
  Page,
  Svg,
  Rect,
  Line as PdfLine,
  Text as PdfText,
  pdf,
} from "@react-pdf/renderer";

import type { LineageChartLayout } from "@/lib/services/lineage-chart";
import { ensureCjkFont } from "@/lib/pdf/fonts";

// A3 横版（pt）：1190 × 842
const PAGE_W = 1190;
const PAGE_H = 842;
const PAGE_MARGIN = 24;

interface RenderInput {
  title: string;
  subtitle: string;
  layout: LineageChartLayout;
  generationChars: Record<string, string>;
}

export async function renderLineageChartPdf(input: RenderInput): Promise<Buffer> {
  const fontFamily = ensureCjkFont();
  const doc = <LineageChartDocument {...input} fontFamily={fontFamily} />;
  const stream = await pdf(doc).toBuffer();
  return await streamToBuffer(stream);
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function LineageChartDocument({
  title,
  subtitle,
  layout,
  generationChars,
  fontFamily,
}: RenderInput & { fontFamily: string }) {
  // 计算缩放使整图填入 A3 横版（标题区 60pt + 边距）
  const headerH = 56;
  const innerW = PAGE_W - PAGE_MARGIN * 2;
  const innerH = PAGE_H - PAGE_MARGIN * 2 - headerH;
  const genColW = 36;
  const usableW = innerW - genColW;
  const scale = Math.min(usableW / Math.max(layout.width, 1), innerH / Math.max(layout.height, 1), 1);

  return (
    <Document title={title} author="家谱系统" creator="familyTree" producer="@react-pdf/renderer">
      <Page size="A3" orientation="landscape" style={{ padding: PAGE_MARGIN, backgroundColor: "#ffffff" }}>
        <Svg width={innerW} height={innerH + headerH} viewBox={`0 0 ${innerW} ${innerH + headerH}`}>
          {/* 标题 */}
          <PdfText
            x={innerW / 2}
            y={26}
            style={{ fontSize: 18, fontWeight: 700, fontFamily }}
            textAnchor="middle"
            fill="#0f172a"
          >
            {title}
          </PdfText>
          <PdfText
            x={innerW / 2}
            y={48}
            style={{ fontSize: 10, fontFamily }}
            textAnchor="middle"
            fill="#64748b"
          >
            {subtitle}
          </PdfText>

          {/* 世代列 */}
          {layout.generations.map((g) => {
            const ch = generationChars[String(g)] ?? "";
            const cy = headerH + (layout.yByGen[g] ?? 0) * scale + 14;
            return (
              <React.Fragment key={`gen-${g}`}>
                <PdfText
                  x={4}
                  y={cy}
                  style={{ fontSize: 8, fontFamily }}
                  fill="#64748b"
                >
                  {`${g} 世`}
                </PdfText>
                {ch && (
                  <PdfText
                    x={4}
                    y={cy + 12}
                    style={{ fontSize: 11, fontWeight: 700, fontFamily }}
                    fill="#0f172a"
                  >
                    {ch}
                  </PdfText>
                )}
              </React.Fragment>
            );
          })}

          {/* 内容（应用 scale）—— 用 transform 在 SVG 中实现 */}
          <Svg
            x={genColW}
            y={headerH}
            width={layout.width * scale}
            height={layout.height * scale}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
          >
            {/* 连线 */}
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

            {/* 节点 */}
            {layout.nodes.map((n) => {
              const dec = n.person.status === "DECEASED";
              const fill = dec ? "#f1f5f9" : "#ffffff";
              const stroke = dec ? "#94a3b8" : "#475569";
              return (
                <React.Fragment key={n.id}>
                  <Rect
                    x={n.x}
                    y={n.y}
                    width={n.width}
                    height={n.height}
                    rx={3}
                    ry={3}
                    fill={fill}
                    stroke={stroke}
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
          </Svg>
        </Svg>
      </Page>
    </Document>
  );
}
