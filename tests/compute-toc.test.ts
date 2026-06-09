import { describe, expect, it } from "vitest";

import { computeToc } from "@/lib/services/album-toc";

describe("computeToc", () => {
  it("封面 1 页 + 目录 1 页 → 首章从第 3 页起（沿用改造前 tocStartPage=3）", () => {
    const { entries, firstContentPage } = computeToc(
      [
        { title: "凡例", count: 1 },
        { title: "谱序", count: 2 },
        { title: "世系图录", count: 5 },
      ],
      { coverPages: 1, tocPages: 1 },
    );
    expect(firstContentPage).toBe(3);
    expect(entries).toEqual([
      { title: "凡例", page: 3 }, // 占 1 页
      { title: "谱序", page: 4 }, // 凡例后一页；占 2 页
      { title: "世系图录", page: 6 }, // 谱序后两页
    ]);
  });

  it("目录溢出多页：tocPages=2 时整体后移一页", () => {
    const { entries, firstContentPage } = computeToc(
      [
        { title: "凡例", count: 1 },
        { title: "跋", count: 1 },
      ],
      { coverPages: 1, tocPages: 2 },
    );
    expect(firstContentPage).toBe(4);
    expect(entries).toEqual([
      { title: "凡例", page: 4 },
      { title: "跋", page: 5 },
    ]);
  });

  it("空章节列表 → 无条目", () => {
    expect(computeToc([], { coverPages: 1, tocPages: 1 }).entries).toEqual([]);
  });
});
