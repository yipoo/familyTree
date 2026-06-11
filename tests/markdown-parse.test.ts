import { describe, expect, it } from "vitest";

import { parseMarkdown, parseInline } from "@/lib/markdown/parse";

describe("parseMarkdown", () => {
  it("空 / 空白 / null → []", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown(null)).toEqual([]);
    expect(parseMarkdown(undefined)).toEqual([]);
    expect(parseMarkdown("   \n  \n")).toEqual([]);
  });

  it("# ## ### 三级标题", () => {
    const b = parseMarkdown("# 一级\n## 二级\n### 三级");
    expect(b).toHaveLength(3);
    expect(b[0]).toMatchObject({ t: "heading", level: 1 });
    expect(b[1]).toMatchObject({ t: "heading", level: 2 });
    expect(b[2]).toMatchObject({ t: "heading", level: 3 });
    const h0 = b[0];
    if (h0.t !== "heading") throw new Error("expected heading");
    expect(h0.inlines).toEqual([{ t: "text", v: "一级" }]);
  });

  it("空行分段", () => {
    const b = parseMarkdown("第一段\n\n第二段");
    expect(b).toHaveLength(2);
    expect(b.every((x) => x.t === "para")).toBe(true);
  });

  it("段内软换行合并为一个 para 并保留 \\n", () => {
    const b = parseMarkdown("甲\n乙");
    expect(b).toHaveLength(1);
    const p = b[0];
    if (p.t !== "para") throw new Error("expected para");
    expect(p.inlines.map((i) => i.v).join("")).toBe("甲\n乙");
  });

  it("无序列表（- / *）连续合并", () => {
    const b = parseMarkdown("- 甲\n* 乙");
    expect(b).toHaveLength(1);
    const l = b[0];
    if (l.t !== "list") throw new Error("expected list");
    expect(l.ordered).toBe(false);
    expect(l.items).toHaveLength(2);
  });

  it("有序列表（1. / 2)）连续合并", () => {
    const b = parseMarkdown("1. 甲\n2) 乙\n3. 丙");
    expect(b).toHaveLength(1);
    const l = b[0];
    if (l.t !== "list") throw new Error("expected list");
    expect(l.ordered).toBe(true);
    expect(l.items).toHaveLength(3);
  });

  it("有序与无序相邻 → 拆成两个 list", () => {
    const b = parseMarkdown("- 甲\n1. 乙");
    expect(b).toHaveLength(2);
    expect(b[0]).toMatchObject({ t: "list", ordered: false });
    expect(b[1]).toMatchObject({ t: "list", ordered: true });
  });

  it("** 开头的加粗段落不被误判为列表项", () => {
    const b = parseMarkdown("**重点**说明");
    expect(b).toHaveLength(1);
    expect(b[0].t).toBe("para");
  });

  it("混合：标题 + 段落 + 列表", () => {
    const b = parseMarkdown("# 谱序\n\n正文一段。\n\n- 要点一\n- 要点二");
    expect(b.map((x) => x.t)).toEqual(["heading", "para", "list"]);
  });
});

describe("parseInline", () => {
  it("加粗切分", () => {
    expect(parseInline("a**b**c")).toEqual([
      { t: "text", v: "a" },
      { t: "strong", v: "b" },
      { t: "text", v: "c" },
    ]);
  });

  it("多个加粗", () => {
    expect(parseInline("**x** y **z**")).toEqual([
      { t: "strong", v: "x" },
      { t: "text", v: " y " },
      { t: "strong", v: "z" },
    ]);
  });

  it("未闭合 ** 原样保留为文本（防漏标记）", () => {
    expect(parseInline("**未闭合")).toEqual([{ t: "text", v: "**未闭合" }]);
  });

  it("纯文本", () => {
    expect(parseInline("普通文字")).toEqual([{ t: "text", v: "普通文字" }]);
  });

  it("空串 → []", () => {
    expect(parseInline("")).toEqual([]);
  });
});
