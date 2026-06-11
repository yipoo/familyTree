/**
 * 册谱前置文本章节（谱序/凡例/源流/族规/自定义）的自适应排版档位（纯函数，可单测）。
 *
 * 旧版固定 13px：短序（三四百字）一页下方留大片空白。现按章节总字数选档——
 * 字少用大号楷体铺满页面，字多逐档缩小、仍超则分页。HTML 与 PDF 共用同一档位，
 * 两端各取 htmlFontPx / pdfFontPt。
 */

export interface TypographyLevel {
  /** 档位号（1 最大） */
  level: 1 | 2 | 3 | 4;
  /** HTML 字号（px）与行高倍数 */
  htmlFontPx: number;
  htmlLineHeight: number;
  /** 该档位下的分页容量（供 paginateBlocks） */
  linesPerPage: number;
  charsPerLine: number;
  /** PDF 字号（pt）与行高倍数 */
  pdfFontPt: number;
  pdfLineHeight: number;
}

const LEVELS: (TypographyLevel & { cap: number })[] = [
  // cap = 单页可容纳的大致字数（linesPerPage × charsPerLine，留落款/标题余量）
  { level: 1, htmlFontPx: 19, htmlLineHeight: 2.1, linesPerPage: 15, charsPerLine: 21, pdfFontPt: 14, pdfLineHeight: 2.0, cap: 300 },
  { level: 2, htmlFontPx: 17, htmlLineHeight: 2.0, linesPerPage: 18, charsPerLine: 24, pdfFontPt: 12.5, pdfLineHeight: 1.95, cap: 420 },
  { level: 3, htmlFontPx: 15, htmlLineHeight: 1.95, linesPerPage: 21, charsPerLine: 27, pdfFontPt: 11, pdfLineHeight: 1.9, cap: 560 },
  { level: 4, htmlFontPx: 13, htmlLineHeight: 1.9, linesPerPage: 22, charsPerLine: 30, pdfFontPt: 10, pdfLineHeight: 1.8, cap: Number.POSITIVE_INFINITY },
];

/**
 * 按章节正文总字数选排版档位：能以更大字号一页放下就用大号（铺满页面），
 * 否则降档；超过最小档容量则维持最小档分页。
 */
export function fitSectionTypography(totalChars: number): TypographyLevel {
  for (const l of LEVELS) {
    if (totalChars <= l.cap) {
      const { cap: _cap, ...rest } = l;
      return rest;
    }
  }
  const { cap: _cap, ...last } = LEVELS[LEVELS.length - 1];
  return last;
}

/** Block[] 的正文字数（粗估，供选档）。 */
export function countBlockChars(
  blocks: { t: string; inlines?: { v: string }[]; items?: { v: string }[][] }[],
): number {
  let n = 0;
  for (const b of blocks) {
    if (b.inlines) for (const seg of b.inlines) n += seg.v.length;
    if (b.items) for (const it of b.items) for (const seg of it) n += seg.v.length;
  }
  return n;
}
