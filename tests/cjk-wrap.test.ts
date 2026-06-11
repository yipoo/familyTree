import { describe, expect, it } from "vitest";

import { splitCjkForWrap } from "@/lib/pdf/cjk-wrap";

describe("splitCjkForWrap（PDF 中文逐字断行拆分）", () => {
  it("纯西文不拆（保持 react-pdf 原生连字行为）", () => {
    expect(splitCjkForWrap("hello")).toEqual(["hello"]);
    expect(splitCjkForWrap("2026/04")).toEqual(["2026/04"]);
  });

  it("中文逐字拆分，parts 拼回恒等于原词", () => {
    expect(splitCjkForWrap("丁氏家谱")).toEqual(["丁", "氏", "家", "谱"]);
  });

  it("行首禁则：句读并入前一字，不会孤悬行首", () => {
    expect(splitCjkForWrap("谱也。")).toEqual(["谱", "也。"]);
    expect(splitCjkForWrap("修，不")).toEqual(["修，", "不"]);
  });

  it("行尾禁则：开括号并入后一字，不会孤悬行尾", () => {
    expect(splitCjkForWrap("【录文说明】")).toEqual(["【录", "文", "说", "明】"]);
  });

  it("连续禁则标点链式合并", () => {
    expect(splitCjkForWrap("也。」")).toEqual(["也。」"]);
  });

  it("中西混排：西文/数字段保持整词", () => {
    expect(splitCjkForWrap("丁氏demo谱2026年")).toEqual([
      "丁",
      "氏",
      "demo",
      "谱",
      "2026",
      "年",
    ]);
  });

  it("半角中点 · 并入前一字", () => {
    expect(splitCjkForWrap("济阳郡·梦松堂")).toEqual(["济", "阳", "郡·", "梦", "松", "堂"]);
  });

  it("全角括号成对禁则，拼接无损", () => {
    const w = "（一九九五年谱·郡志人物传）";
    const parts = splitCjkForWrap(w);
    expect(parts[0]).toBe("（一");
    expect(parts[parts.length - 1]).toBe("传）");
    expect(parts.join("")).toBe(w);
  });
});
