import { describe, expect, it } from "vitest";

import {
  formatPersonEntryText,
  paginateVolume,
  type AlbumChapter,
  type AlbumPageItem,
  type AlbumPersonEntry,
  type AlbumVolume,
} from "@/lib/services/album";

const ENTRY: AlbumPersonEntry = {
  id: "p1",
  name: "丁老",
  alias: "大老",
  generation: 1,
  generationChar: "天",
  gender: "MALE",
  birthOrder: 1,
  birthYear: 1900,
  deathYear: 1980,
  birthDate: null,
  deathDate: null,
  birthPlace: "丁庄",
  status: "DECEASED",
  succession: null,
  isMarriedIn: false,
  paperRecord: "纸谱有载",
  biography: "传奇一生",
  noteHint: null,
  fatherName: "丁太公",
  motherName: "李氏",
  spouses: [
    { name: "王氏", type: "PRIMARY", order: 1 },
    { name: "赵氏", type: "SECONDARY", order: 2 },
  ],
  spouseNames: ["王氏", "赵氏"],
  sons: ["丁二"],
  daughters: ["丁三"],
  childrenNames: ["丁二", "丁三"],
  residenceText: "山东省济南市丁庄",
  ageAtDeath: 81,
};

describe("formatPersonEntryText", () => {
  const txt = formatPersonEntryText(ENTRY);

  it("以世代+字辈起头", () => {
    expect(txt).toMatch(/【第 1 世·天】/);
  });

  it("写入姓名 + 字号 + 性别 + 行第（汉字）", () => {
    expect(txt).toContain("丁老");
    expect(txt).toContain("（字大老）");
    expect(txt).toContain("男");
    expect(txt).toContain("行一");
  });

  it("包含父母", () => {
    expect(txt).toContain("父：丁太公");
    expect(txt).toContain("母：李氏");
  });

  it("包含生卒 / 享年 / 出生地 / 居住地", () => {
    expect(txt).toContain("生于1900 年");
    expect(txt).toContain("卒于1980 年");
    expect(txt).toContain("享年 81 岁");
    expect(txt).toContain("出生于 丁庄");
    expect(txt).toContain("居：山东省济南市丁庄");
  });

  it("配偶分元配 / 继配 / 妾 标签", () => {
    expect(txt).toContain("元配 王氏");
    expect(txt).toContain("继配 赵氏");
  });

  it("子女分别记 子 N / 女 N", () => {
    expect(txt).toContain("子一：丁二");
    expect(txt).toContain("女一：丁三");
  });

  it("包含纸谱行传 / 个人传记", () => {
    expect(txt).toContain("纸谱行传：纸谱有载");
    expect(txt).toContain("传：传奇一生");
  });

  it("空字段时不输出对应段落", () => {
    const minimal: AlbumPersonEntry = {
      id: "p9",
      name: "无名",
      alias: null,
      generation: 5,
      generationChar: null,
      gender: "UNKNOWN",
      birthOrder: null,
      birthYear: null,
      deathYear: null,
      birthDate: null,
      deathDate: null,
      birthPlace: null,
      status: "UNKNOWN",
      succession: null,
      isMarriedIn: false,
      paperRecord: null,
      biography: null,
      noteHint: null,
      fatherName: null,
      motherName: null,
      spouses: [],
      spouseNames: [],
      sons: [],
      daughters: [],
      childrenNames: [],
      residenceText: null,
      ageAtDeath: null,
    };
    const t = formatPersonEntryText(minimal);
    expect(t).toContain("【第 5 世】");
    expect(t).not.toContain("配：");
    expect(t).not.toContain("子");
    expect(t).not.toContain("女");
    expect(t).not.toContain("传：");
  });
});

describe("paginateVolume", () => {
  const mkEntry = (id: string, generation: number): AlbumPersonEntry => ({
    ...ENTRY,
    id,
    name: id,
    generation,
  });
  const mkChapter = (generation: number, n: number): AlbumChapter => ({
    generation,
    generationChar: null,
    entries: Array.from({ length: n }, (_, i) => mkEntry(`g${generation}-${i + 1}`, generation)),
  });
  const mkVol = (chapters: AlbumChapter[]): AlbumVolume => ({
    branchId: null,
    branchName: "（未分支）",
    count: chapters.reduce((s, c) => s + c.entries.length, 0),
    chapters,
  });

  const entryItems = (pages: AlbumPageItem[][]) =>
    pages.flat().filter((it) => it.kind === "entry");

  it("小卷不超过上限时只产出一个页元素", () => {
    const pages = paginateVolume(mkVol([mkChapter(1, 5), mkChapter(2, 3)]), 300);
    expect(pages).toHaveLength(1);
    // 两个世标题 + 8 条
    expect(pages[0].filter((i) => i.kind === "heading")).toHaveLength(2);
    expect(entryItems(pages)).toHaveLength(8);
  });

  it("条目超过上限时切成多个页元素", () => {
    const pages = paginateVolume(mkVol([mkChapter(1, 250)]), 100);
    expect(pages.length).toBe(3); // 100 + 100 + 50
    expect(entryItems(pages)).toHaveLength(250);
  });

  it("全部条目无丢失、无重复，且每章 entryNo 从 1 连续递增", () => {
    const pages = paginateVolume(mkVol([mkChapter(1, 230), mkChapter(2, 90)]), 100);
    const entries = entryItems(pages);
    expect(entries).toHaveLength(320);
    // 第 1 世：entryNo 1..230，顺序正确
    const gen1 = entries.filter((e) => e.kind === "entry" && e.chapter.generation === 1);
    expect(gen1.map((e) => (e.kind === "entry" ? e.entryNo : 0))).toEqual(
      Array.from({ length: 230 }, (_, i) => i + 1),
    );
    // id 全唯一
    const ids = entries.map((e) => (e.kind === "entry" ? e.entry.id : ""));
    expect(new Set(ids).size).toBe(320);
  });

  it("一章跨页元素时，后续页元素以「（续）」标题开头", () => {
    const pages = paginateVolume(mkVol([mkChapter(1, 250)]), 100);
    // 第一页开头是非续标题，第二、三页开头是续标题
    const head0 = pages[0][0];
    expect(head0.kind).toBe("heading");
    expect(head0.kind === "heading" && head0.continued).toBeFalsy();
    expect(pages[1][0]).toMatchObject({ kind: "heading", continued: true, chapter: { generation: 1 } });
    expect(pages[2][0]).toMatchObject({ kind: "heading", continued: true });
  });

  it("页元素不以「标题」结尾（杜绝世标题孤儿）", () => {
    const pages = paginateVolume(
      mkVol([mkChapter(1, 100), mkChapter(2, 100), mkChapter(3, 1)]),
      100,
    );
    for (const page of pages) {
      expect(page[page.length - 1].kind).not.toBe("heading");
    }
  });

  it("空代产出「标题 + 空占位」", () => {
    const pages = paginateVolume(mkVol([mkChapter(1, 0)]), 100);
    expect(pages).toHaveLength(1);
    expect(pages[0].map((i) => i.kind)).toEqual(["heading", "empty"]);
  });

  it("每章首次出现都带一个非续世标题", () => {
    const pages = paginateVolume(mkVol([mkChapter(1, 120), mkChapter(2, 50)]), 100);
    const freshHeadings = pages
      .flat()
      .filter((it) => it.kind === "heading" && !it.continued)
      .map((it) => (it.kind === "heading" ? it.chapter.generation : 0));
    expect(freshHeadings).toEqual([1, 2]);
  });
});
