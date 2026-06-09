import { describe, expect, it } from "vitest";

import { formatPersonEntryText, type AlbumPersonEntry } from "@/lib/services/album";

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
