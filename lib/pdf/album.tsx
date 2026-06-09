/**
 * 用 @react-pdf/renderer 渲染册谱 PDF（数据驱动）。
 *
 * A4 竖版：封面 → 前置章节（按 book.sections 的 order）→ 各卷世系传（牒记行传）。
 * 前置章节文本/模板/自定义/字辈与屏幕端共享同一份数据与文案（lib/services/album-templates.ts、
 * lib/markdown）。修谱人员 / 世系图录 / 像赞依赖成员/头像/树数据，暂不在此渲染（P2 补齐）。
 */
import * as React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";

import { type AlbumBook, formatPersonEntryText } from "@/lib/services/album";
import { ensureCjkFont } from "@/lib/pdf/fonts";
import { parseMarkdown } from "@/lib/markdown/parse";
import { MarkdownPdf } from "@/lib/pdf/markdown-pdf";
import { defaultTitleForKind, type ResolvedSection } from "@/lib/services/album-sections";
import {
  fanliItems,
  yuanliuContent,
  postscriptContent,
} from "@/lib/services/album-templates";
import { AlbumSectionKind } from "@/lib/generated/prisma/enums";

export async function renderAlbumPdf(book: AlbumBook): Promise<Buffer> {
  const fontFamily = ensureCjkFont();
  try {
    const stream = await pdf(
      <AlbumDocument book={book} fontFamily={fontFamily} />,
    ).toBuffer();
    return await streamToBuffer(stream);
  } catch (e) {
    // 已知 react-pdf 在超大族谱（数千条世系传）复杂分页下可能抛布局错误
    // （unsupported number…）。回退到"仅前置内容 + 说明页"，保证产出可用 PDF
    // 而非整本失败。常规规模家族不会触发。
    console.error("[pdf] 完整册谱渲染失败，回退到仅前置内容版：", e);
    const stream = await pdf(
      <AlbumDocument
        book={{ ...book, volumes: [] }}
        fontFamily={fontFamily}
        degraded
      />,
    ).toBuffer();
    return await streamToBuffer(stream);
  }
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/** PDF 端只稳定支持 jpg/png；其它格式渲染占位，避免整本 PDF 崩溃。 */
function isPdfSafeImage(url: string): boolean {
  return /\.(jpe?g|png)(\?|#|$)/i.test(url);
}

function AlbumDocument({
  book,
  fontFamily,
  degraded,
}: {
  book: AlbumBook;
  fontFamily: string;
  /** 兜底模式：完整渲染失败后只出前置内容 + 说明页。 */
  degraded?: boolean;
}) {
  const styles = makeStyles(fontFamily);
  const titleZh = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

  // 前置章节：与 HTML 合编本同一过滤规则；封面单独处理
  const cover = book.sections.find(
    (s) => s.kind === AlbumSectionKind.COVER && s.enabled,
  );
  const active = book.sections.filter(
    (s) =>
      s.enabled &&
      s.kind !== AlbumSectionKind.COVER &&
      (s.appliesTo.length === 0 || s.appliesTo.includes("complete")),
  );

  return (
    <Document
      title={`${book.family.name} 册谱`}
      author="家谱系统"
      creator="familyTree"
    >
      {/* 封面 */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverInner}>
          {cover?.imageUrl && isPdfSafeImage(cover.imageUrl) && (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf <Image> 无 alt 属性
            <Image src={cover.imageUrl} style={styles.coverImage} />
          )}
          <Text style={styles.coverSurname}>
            {book.family.surname} 氏{cover?.subtitle ? ` · ${cover.subtitle}` : "家族"}
          </Text>
          <Text style={styles.coverTitle}>{cover?.title?.trim() || book.family.name}</Text>
          {book.family.editionInfo && (
            <Text style={styles.coverEdition}>·{book.family.editionInfo}·</Text>
          )}
          {book.family.founderName && (
            <Text style={styles.coverFounder}>始祖 · {book.family.founderName}</Text>
          )}
          <Text style={styles.coverMeta}>
            {cover?.signature?.trim() ||
              `${new Date(book.generatedAt).getFullYear()} 年 修 · 收录 ${book.totalPersons} 人`}
          </Text>
        </View>
      </Page>

      {/* 前置章节（按 order） */}
      {active.map((sec, i) => (
        <SectionPage
          key={sec.id ?? `sec-${i}`}
          sec={sec}
          book={book}
          styles={styles}
          fontFamily={fontFamily}
        />
      ))}

      {/* 兜底模式说明页 */}
      {degraded && (
        <Page size="A4" style={styles.page}>
          <Header title={book.family.name} fontFamily={fontFamily} />
          <Text style={styles.secTitle}>说 明</Text>
          <Text style={styles.indentBody}>
            本族世系传内容较多，PDF 完整排版暂未能导出，此版仅含封面与前置内容。
            完整世系请在网页端「册谱」查看与打印，或联系管理员。
          </Text>
          <Footer />
        </Page>
      )}

      {/* 各卷·世系传（牒记行传） */}
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

/** 单个前置章节 → 一张 <Page wrap>（react-pdf 自动分页溢出内容）。无内容返回 null。 */
function SectionPage({
  sec,
  book,
  styles,
  fontFamily,
}: {
  sec: ResolvedSection;
  book: AlbumBook;
  styles: ReturnType<typeof makeStyles>;
  fontFamily: string;
}) {
  const title = sec.title?.trim() || defaultTitleForKind(sec.kind);
  const hasBody = !!sec.body && sec.body.trim().length > 0;

  const content = renderSectionContent(sec, book, styles, fontFamily, hasBody);
  if (content === null) return null;

  return (
    <Page size="A4" style={styles.page} wrap>
      <Header title={book.family.name} fontFamily={fontFamily} />
      <Text style={styles.secTitle}>{title}</Text>
      {content}
      {sec.signature?.trim() && !hasBody && (
        <Text style={styles.signature}>{sec.signature}</Text>
      )}
      <Footer />
    </Page>
  );
}

function renderSectionContent(
  sec: ResolvedSection,
  book: AlbumBook,
  styles: ReturnType<typeof makeStyles>,
  fontFamily: string,
  hasBody: boolean,
): React.ReactNode | null {
  const md = (src: string) => (
    <MarkdownPdf blocks={parseMarkdown(src)} fontFamily={fontFamily} />
  );
  if (hasBody) {
    return (
      <>
        {md(sec.body!)}
        {sec.signature?.trim() && <Text style={styles.signature}>{sec.signature}</Text>}
      </>
    );
  }

  switch (sec.kind) {
    case AlbumSectionKind.FANLI:
      return (
        <View>
          {fanliItems(book, book.compilerCount).map((it, i) => (
            <View key={i} style={styles.li}>
              <Text style={styles.liNum}>{i + 1}、</Text>
              <Text style={styles.liText}>{it}</Text>
            </View>
          ))}
        </View>
      );
    case AlbumSectionKind.PREFACE:
      return book.family.description ? (
        <Text style={styles.indentBody}>{book.family.description}</Text>
      ) : null;
    case AlbumSectionKind.YUANLIU: {
      const c = yuanliuContent(book);
      if (c.kind === "custom") return <Text style={styles.body}>{c.text}</Text>;
      return (
        <View>
          {c.paragraphs.map((p, i) => (
            <Text key={i} style={styles.indentBody}>
              {p}
            </Text>
          ))}
          <Text style={styles.note}>{c.note}</Text>
        </View>
      );
    }
    case AlbumSectionKind.RULES:
      return book.family.familyRules ? (
        <Text style={styles.body}>{book.family.familyRules}</Text>
      ) : null;
    case AlbumSectionKind.POSTSCRIPT: {
      const c = postscriptContent(book);
      return (
        <View>
          {c.paragraphs.map((p, i) => (
            <Text key={i} style={styles.indentBody}>
              {p}
            </Text>
          ))}
          <Text style={styles.signature}>{c.date}</Text>
        </View>
      );
    }
    case AlbumSectionKind.ZIBEI:
      return book.generationNames.length > 0 ? (
        <View style={styles.charList}>
          {book.generationNames.map((g) => (
            <View key={g.generation} style={styles.charCell}>
              <Text style={styles.charGen}>{g.generation}世</Text>
              <Text style={styles.charCh}>{g.character}</Text>
            </View>
          ))}
        </View>
      ) : null;
    case AlbumSectionKind.CUSTOM_IMAGE:
      if (!sec.imageUrl) return null;
      return isPdfSafeImage(sec.imageUrl) ? (
        <View style={styles.imageWrap}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf <Image> 无 alt 属性 */}
          <Image src={sec.imageUrl} style={styles.sectionImage} />
          {sec.body?.trim() && <Text style={styles.caption}>{sec.body}</Text>}
        </View>
      ) : (
        <Text style={styles.note}>（图片格式 PDF 不支持，请改用 JPG / PNG）</Text>
      );
    // 数据驱动章节依赖成员/头像/树数据，PDF 端暂不渲染（P2）
    case AlbumSectionKind.COMPILERS:
    case AlbumSectionKind.TULU:
    case AlbumSectionKind.PORTRAITS:
    case AlbumSectionKind.CUSTOM_TEXT: // 无 body 的自定义章节不出页
    case AlbumSectionKind.COVER:
    default:
      return null;
  }
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
      paddingTop: 160,
      paddingHorizontal: 60,
      fontFamily,
    },
    coverInner: { alignItems: "center" },
    coverImage: { width: 120, height: 120, objectFit: "contain", marginBottom: 18 },
    coverSurname: { fontSize: 14, color: "#64748b", letterSpacing: 4, fontFamily },
    coverTitle: {
      marginTop: 18,
      fontSize: 36,
      fontWeight: 700,
      letterSpacing: 8,
      color: "#0f172a",
      fontFamily,
    },
    coverEdition: { marginTop: 8, fontSize: 12, letterSpacing: 4, color: "#475569", fontFamily },
    coverFounder: { marginTop: 18, fontSize: 14, color: "#475569", fontFamily },
    coverMeta: { marginTop: 60, fontSize: 9, color: "#94a3b8", fontFamily },

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
    secTitle: {
      marginTop: 8,
      marginBottom: 12,
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: 6,
      textAlign: "center",
      color: "#0f172a",
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
    indentBody: {
      fontSize: 10,
      lineHeight: 1.8,
      color: "#0f172a",
      textAlign: "justify",
      textIndent: 20,
      marginBottom: 6,
      fontFamily,
    },
    note: { marginTop: 8, fontSize: 9, color: "#94a3b8", lineHeight: 1.6, fontFamily },
    signature: { marginTop: 16, fontSize: 9, color: "#64748b", textAlign: "right", fontFamily },
    li: { flexDirection: "row", marginBottom: 6 },
    liNum: { width: 24, fontSize: 10, color: "#64748b", fontFamily },
    liText: { flex: 1, fontSize: 10, lineHeight: 1.7, color: "#0f172a", fontFamily },
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
    imageWrap: { alignItems: "center", marginTop: 8 },
    sectionImage: { maxWidth: "100%", maxHeight: 560, objectFit: "contain" },
    caption: { marginTop: 6, fontSize: 9, color: "#64748b", textAlign: "center", fontFamily },
  });
}
