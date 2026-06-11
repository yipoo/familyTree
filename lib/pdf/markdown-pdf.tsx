/**
 * Markdown → @react-pdf/renderer 薄渲染器（PDF 端）。
 * 与屏幕端 components/album/MarkdownBlocks.tsx 消费同一份 Block[]（lib/markdown/parse.ts）。
 *
 * react-pdf 只认 <Text>/<View>：段内软换行（"\n"）由 <Text> 原生换行；列表项前缀手动加。
 * 分页交给 <Page wrap>，不需要 paginateBlocks。
 */
import * as React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

import type { Block, Inline } from "@/lib/markdown/parse";

export function MarkdownPdf({
  blocks,
  fontFamily,
  baseSize = 10,
  lineHeight = 1.7,
}: {
  blocks: Block[];
  fontFamily: string;
  /** 正文基准字号（pt），由章节自适应档位决定（album-typo） */
  baseSize?: number;
  lineHeight?: number;
}) {
  const s = makeStyles(fontFamily, baseSize, lineHeight);
  return (
    <View>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} s={s} />
      ))}
    </View>
  );
}

function BlockView({
  block,
  s,
}: {
  block: Block;
  s: ReturnType<typeof makeStyles>;
}) {
  if (block.t === "heading") {
    const st =
      block.level === 1 ? s.h1 : block.level === 2 ? s.h2 : s.h3;
    return (
      <Text style={st}>
        <Inlines inlines={block.inlines} s={s} />
      </Text>
    );
  }
  if (block.t === "list") {
    return (
      <View style={s.list}>
        {block.items.map((it, i) => (
          <View key={i} style={s.li}>
            <Text style={s.bullet}>{block.ordered ? `${i + 1}. ` : "• "}</Text>
            <Text style={s.liText}>
              <Inlines inlines={it} s={s} />
            </Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <Text style={s.para}>
      <Inlines inlines={block.inlines} s={s} />
    </Text>
  );
}

function Inlines({
  inlines,
  s,
}: {
  inlines: Inline[];
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <>
      {inlines.map((seg, i) =>
        seg.t === "strong" ? (
          <Text key={i} style={s.strong}>
            {seg.v}
          </Text>
        ) : (
          <Text key={i}>{seg.v}</Text>
        ),
      )}
    </>
  );
}

function makeStyles(fontFamily: string, fs = 10, lh = 1.7) {
  return StyleSheet.create({
    h1: { fontSize: fs * 1.3, fontWeight: 700, marginTop: 8, marginBottom: 4, color: "#0f172a", fontFamily },
    h2: { fontSize: fs * 1.15, fontWeight: 700, marginTop: 6, marginBottom: 3, color: "#1e293b", fontFamily },
    h3: { fontSize: fs * 1.05, fontWeight: 700, marginTop: 4, marginBottom: 2, color: "#1e293b", fontFamily },
    para: { fontSize: fs, lineHeight: lh, marginBottom: 4, textAlign: "justify", color: "#0f172a", fontFamily },
    strong: { fontWeight: 700, fontFamily },
    list: { marginTop: 2, marginBottom: 4 },
    li: { flexDirection: "row", marginBottom: 2 },
    bullet: { fontSize: fs, color: "#475569", fontFamily },
    liText: { flex: 1, fontSize: fs, lineHeight: lh, color: "#0f172a", fontFamily },
  });
}
