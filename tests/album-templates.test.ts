import { describe, expect, it } from "vitest";

import {
  fanliItems,
  yuanliuContent,
  postscriptContent,
} from "@/lib/services/album-templates";
import type { AlbumBook } from "@/lib/services/album";

function mkBook(
  family: Partial<AlbumBook["family"]> = {},
  rest: Partial<AlbumBook> = {},
): AlbumBook {
  return {
    family: {
      id: "f",
      name: "丁氏家族",
      surname: "丁",
      description: null,
      founderName: "丁公",
      familyRules: null,
      editionInfo: null,
      surnameOrigin: null,
      ...family,
    },
    generationNames: [],
    volumes: [{ branchId: null, branchName: "x", count: 0, chapters: [] }],
    sections: [],
    members: [],
    compilerCount: 3,
    portraits: [],
    lineageChunks: [],
    generatedAt: "2026-06-09T00:00:00.000Z",
    totalPersons: 100,
    ...rest,
  };
}

describe("fanliItems", () => {
  it("含始祖、修谱人数、收录人数与卷数", () => {
    const items = fanliItems(mkBook(), 3);
    expect(items).toHaveLength(8);
    expect(items[0]).toContain("丁");
    expect(items[0]).toContain("丁公");
    expect(items.some((s) => s.includes("3 人"))).toBe(true);
    expect(items.some((s) => s.includes("100 名"))).toBe(true);
  });

  it("无始祖时退化为「始祖」", () => {
    const items = fanliItems(mkBook({ founderName: null }), 1);
    expect(items[0]).toContain("为本族一世");
    expect(items[0]).not.toContain("公为");
  });
});

describe("yuanliuContent", () => {
  it("填了 surnameOrigin → custom", () => {
    const c = yuanliuContent(mkBook({ surnameOrigin: "丁氏出自姜姓……" }));
    expect(c.kind).toBe("custom");
    if (c.kind === "custom") expect(c.text).toContain("姜姓");
  });

  it("未填 → template，含姓氏与始祖、附按语", () => {
    const c = yuanliuContent(mkBook());
    expect(c.kind).toBe("template");
    if (c.kind === "template") {
      expect(c.paragraphs[0]).toContain("丁公");
      expect(c.paragraphs).toHaveLength(2);
      expect(c.note).toContain("按");
    }
  });

  it("template 无始祖时给替代句", () => {
    const c = yuanliuContent(mkBook({ founderName: null }));
    if (c.kind === "template") {
      expect(c.paragraphs[0]).toContain("本族始祖之事迹");
    }
  });
});

describe("postscriptContent", () => {
  it("两段正文 + 年月落款", () => {
    const c = postscriptContent(mkBook());
    expect(c.paragraphs).toHaveLength(2);
    expect(c.paragraphs[0]).toContain("丁氏家族");
    expect(c.paragraphs[0]).toContain("100 人");
    expect(c.date).toBe("2026 年 6 月");
  });
});
