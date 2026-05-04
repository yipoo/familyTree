/**
 * 用 @react-pdf/renderer 渲染册谱 PDF。
 *
 * A4 竖版，页眉 / 页码 / 各卷标题 / 人物条目正文。
 * 自动分页（react-pdf 的内置流式布局）。
 */
import * as React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";

import { type AlbumBook, formatPersonEntryText } from "@/lib/services/album";
import { ensureCjkFont } from "@/lib/pdf/fonts";

export async function renderAlbumPdf(book: AlbumBook): Promise<Buffer> {
  const fontFamily = ensureCjkFont();
  const stream = await pdf(<AlbumDocument book={book} fontFamily={fontFamily} />).toBuffer();
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

function AlbumDocument({
  book,
  fontFamily,
}: {
  book: AlbumBook;
  fontFamily: string;
}) {
  const styles = makeStyles(fontFamily);
  const titleZh = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

  return (
    <Document
      title={`${book.family.name} 册谱`}
      author="家谱系统"
      creator="familyTree"
    >
      {/* 封面 */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverInner}>
          <Text style={styles.coverSurname}>{book.family.surname} 氏家族</Text>
          <Text style={styles.coverTitle}>{book.family.name}</Text>
          {book.family.founderName && (
            <Text style={styles.coverFounder}>始祖 · {book.family.founderName}</Text>
          )}
          <Text style={styles.coverMeta}>
            生成于 {new Date(book.generatedAt).toLocaleString("zh-CN")}
          </Text>
        </View>
      </Page>

      {/* 序 + 字辈表 */}
      {(book.family.description || book.generationNames.length > 0) && (
        <Page size="A4" style={styles.page} wrap>
          <Header title={book.family.name} fontFamily={fontFamily} />
          <Text style={styles.h2}>序</Text>
          {book.family.description && (
            <Text style={styles.body}>{book.family.description}</Text>
          )}
          {book.generationNames.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.h3}>字辈表</Text>
              <View style={styles.charList}>
                {book.generationNames.map((g) => (
                  <View key={g.generation} style={styles.charCell}>
                    <Text style={styles.charGen}>{g.generation}世</Text>
                    <Text style={styles.charCh}>{g.character}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          <Footer />
        </Page>
      )}

      {/* 各卷 */}
      {book.volumes.map((vol, vi) => (
        <Page key={vol.branchId ?? `__no_${vi}`} size="A4" style={styles.page} wrap>
          <Header title={book.family.name} fontFamily={fontFamily} />
          <Text style={styles.h2}>
            卷之{titleZh[vi] ?? vi + 1}　{vol.branchName}
          </Text>
          <Text style={styles.subtitle}>收录 {vol.count} 人</Text>
          {vol.chapters.map((ch) => (
            <View key={ch.generation} style={styles.chapter} wrap>
              <Text style={styles.h3}>
                第 {ch.generation} 世{ch.generationChar ? `·${ch.generationChar}` : ""}
                <Text style={styles.subtle}>　 {ch.entries.length} 人</Text>
              </Text>
              {ch.entries.map((e, ei) => (
                <View key={e.id} style={styles.entry} wrap={false}>
                  <Text style={styles.body}>
                    <Text style={styles.entryNum}>{ei + 1}. </Text>
                    {formatPersonEntryText(e)}
                  </Text>
                </View>
              ))}
              {ch.entries.length === 0 && (
                <Text style={styles.subtle}>本世暂无</Text>
              )}
            </View>
          ))}
          <Footer />
        </Page>
      ))}
    </Document>
  );
}

function Header({ title, fontFamily }: { title: string; fontFamily: string }) {
  const s = makeStyles(fontFamily);
  return (
    <View style={s.header} fixed>
      <Text>{title} · 册谱</Text>
    </View>
  );
}

function Footer() {
  return (
    <Text
      style={{
        position: "absolute",
        bottom: 24,
        left: 0,
        right: 0,
        textAlign: "center",
        fontSize: 8,
        color: "#94a3b8",
      }}
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      fixed
    />
  );
}

function makeStyles(fontFamily: string) {
  return StyleSheet.create({
    coverPage: {
      backgroundColor: "#ffffff",
      paddingTop: 200,
      paddingHorizontal: 60,
      fontFamily,
    },
    coverInner: { alignItems: "center" },
    coverSurname: { fontSize: 14, color: "#64748b", letterSpacing: 4, fontFamily },
    coverTitle: {
      marginTop: 18,
      fontSize: 36,
      fontWeight: 700,
      letterSpacing: 8,
      color: "#0f172a",
      fontFamily,
    },
    coverFounder: { marginTop: 24, fontSize: 14, color: "#475569", fontFamily },
    coverMeta: { marginTop: 80, fontSize: 9, color: "#94a3b8", fontFamily },

    page: {
      paddingTop: 56,
      paddingBottom: 56,
      paddingHorizontal: 56,
      fontFamily,
      fontSize: 10,
      lineHeight: 1.6,
      color: "#0f172a",
    },
    header: {
      position: "absolute",
      top: 24,
      left: 56,
      right: 56,
      paddingBottom: 4,
      borderBottomWidth: 0.5,
      borderBottomColor: "#cbd5e1",
      fontSize: 9,
      color: "#64748b",
      textAlign: "center",
      fontFamily,
    },
    h2: {
      marginTop: 8,
      fontSize: 16,
      fontWeight: 700,
      color: "#0f172a",
      fontFamily,
    },
    h3: {
      marginTop: 12,
      marginBottom: 6,
      fontSize: 12,
      fontWeight: 700,
      color: "#1e293b",
      borderBottomWidth: 0.5,
      borderBottomColor: "#cbd5e1",
      paddingBottom: 2,
      fontFamily,
    },
    subtitle: { marginTop: 2, fontSize: 9, color: "#64748b", fontFamily },
    subtle: { fontSize: 9, color: "#94a3b8", fontFamily },
    chapter: { marginBottom: 8 },
    entry: { marginBottom: 4 },
    entryNum: { color: "#94a3b8", fontFamily },
    body: {
      fontSize: 10,
      lineHeight: 1.7,
      color: "#0f172a",
      textAlign: "justify",
      fontFamily,
    },
    charList: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
    charCell: {
      borderWidth: 0.5,
      borderColor: "#cbd5e1",
      borderRadius: 2,
      paddingHorizontal: 4,
      paddingVertical: 2,
      flexDirection: "row",
      alignItems: "baseline",
      gap: 3,
    },
    charGen: { fontSize: 7, color: "#64748b", fontFamily },
    charCh: { fontSize: 11, fontWeight: 700, fontFamily },
  });
}
