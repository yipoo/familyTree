/**
 * Markdown 翻书分页（纯函数，可单测）。
 *
 * 翻书页面高度固定，长正文需切分多页。无法测量真实 DOM，故按"估算行数"贪心切分，
 * 与既有 familyRulesPages 的"按行分页"同一思路。供屏幕端 MarkdownBlocks 使用。
 */
import { parseMarkdown, type Block, type Inline } from "./parse";

export interface PaginateOpts {
  /** 每页可容纳的估算行数 */
  linesPerPage?: number;
  /** 每行可容纳的字符数（中文窄页约 30） */
  charsPerLine?: number;
}

/**
 * 把 Block[] 按估算行数贪心切分成多页。单块超过一页也至少独占一页；
 * 空输入返回 [[]]（一张空页，便于上层统一处理）。
 */
export function paginateBlocks(blocks: Block[], opts: PaginateOpts = {}): Block[][] {
  const linesPerPage = opts.linesPerPage ?? 22;
  const charsPerLine = opts.charsPerLine ?? 30;
  const pages: Block[][] = [];
  let cur: Block[] = [];
  let used = 0;

  for (const b of blocks) {
    const cost = estimateLines(b, charsPerLine);
    if (cur.length > 0 && used + cost > linesPerPage) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(b);
    used += cost;
  }
  if (cur.length > 0) pages.push(cur);
  return pages.length > 0 ? pages : [[]];
}

/** 便捷：直接从源码 markdown 切页。 */
export function paginateMarkdown(src: string, opts?: PaginateOpts): Block[][] {
  return paginateBlocks(parseMarkdown(src), opts);
}

function inlineLen(inlines: Inline[]): number {
  return inlines.reduce((n, seg) => n + seg.v.length, 0);
}

function softBreakRows(inlines: Inline[], charsPerLine: number): number {
  const joined = inlines.map((s) => s.v).join("");
  const segs = joined.split("\n");
  return segs.reduce(
    (n, seg) => n + Math.max(1, Math.ceil(seg.length / charsPerLine)),
    0,
  );
}

function estimateLines(block: Block, charsPerLine: number): number {
  if (block.t === "heading") return 2;
  if (block.t === "list") {
    return block.items.reduce(
      (n, it) => n + Math.max(1, Math.ceil(inlineLen(it) / charsPerLine)),
      0,
    );
  }
  return softBreakRows(block.inlines, charsPerLine);
}
