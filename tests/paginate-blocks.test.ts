import { describe, expect, it } from "vitest";

import { parseMarkdown } from "@/lib/markdown/parse";
import { paginateBlocks, paginateMarkdown } from "@/lib/markdown/paginate";

describe("paginateBlocks", () => {
  it("空输入 → 一张空页", () => {
    expect(paginateBlocks([])).toEqual([[]]);
  });

  it("短内容 → 单页", () => {
    const pages = paginateMarkdown("# 标题\n\n短短一句。");
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(2);
  });

  it("超过每页行数 → 切多页", () => {
    // 12 个段落，每段约 1 行；linesPerPage=5 → 至少 3 页
    const src = Array.from({ length: 12 }, (_, i) => `第 ${i} 段。`).join("\n\n");
    const pages = paginateBlocks(parseMarkdown(src), { linesPerPage: 5 });
    expect(pages.length).toBeGreaterThanOrEqual(3);
    // 不丢块：各页块数之和 = 原块数
    const total = pages.reduce((n, p) => n + p.length, 0);
    expect(total).toBe(12);
  });

  it("长段落按字符宽度估算占多行", () => {
    const long = "字".repeat(300); // charsPerLine=30 → 约 10 行
    const pages = paginateBlocks(parseMarkdown(`${long}\n\n${long}`), {
      linesPerPage: 12,
      charsPerLine: 30,
    });
    expect(pages.length).toBeGreaterThanOrEqual(2);
  });

  it("单块超过一页也至少独占一页（不丢内容）", () => {
    const huge = "字".repeat(1000);
    const pages = paginateBlocks(parseMarkdown(huge), {
      linesPerPage: 5,
      charsPerLine: 30,
    });
    expect(pages.length).toBeGreaterThanOrEqual(1);
    const total = pages.reduce((n, p) => n + p.length, 0);
    expect(total).toBe(1);
  });
});
