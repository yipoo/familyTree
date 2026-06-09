import { describe, expect, it } from "vitest";

import {
  buildBiographyMessages,
  formatFactSheet,
  type BiographyFacts,
} from "@/lib/services/biography";

const FULL: BiographyFacts = {
  name: "丁三",
  alias: "茂卿",
  gender: "MALE",
  generation: 5,
  generationChar: "茂",
  birthYear: 1901,
  deathYear: 1972,
  birthPlace: "丁家庄",
  residence: "上海",
  status: "DECEASED",
  branchName: "长房",
  succession: null,
  fatherName: "丁二",
  motherName: "王氏",
  spouses: [
    { name: "李氏", type: "PRIMARY" },
    { name: "赵氏", type: "SECONDARY" },
  ],
  children: [
    { name: "丁甲", gender: "MALE" },
    { name: "丁乙", gender: "MALE" },
    { name: "丁丫", gender: "FEMALE" },
  ],
  hints: "曾经商沪上",
};

describe("formatFactSheet", () => {
  it("包含核心事实且按类整理", () => {
    const sheet = formatFactSheet(FULL);
    expect(sheet).toContain("丁三");
    expect(sheet).toContain("茂卿");
    expect(sheet).toContain("第 5 世");
    expect(sheet).toContain("字辈「茂」");
    expect(sheet).toContain("生年：1901");
    expect(sheet).toContain("享年：约 71 岁");
    expect(sheet).toContain("原配");
    expect(sheet).toContain("继配");
    expect(sheet).toContain("子 2 人：丁甲、丁乙");
    expect(sheet).toContain("女 1 人：丁丫");
    expect(sheet).toContain("曾经商沪上");
  });

  it("最小事实不崩，缺项不输出空行噪音", () => {
    const sheet = formatFactSheet({
      name: "无名",
      gender: "UNKNOWN",
      generation: 1,
    });
    expect(sheet).toContain("无名");
    expect(sheet).not.toContain("享年");
    expect(sheet).not.toContain("配偶");
    expect(sheet).not.toContain("子女");
  });
});

describe("buildBiographyMessages", () => {
  it("含 system 反幻觉约束 + user 事实清单", () => {
    const msgs = buildBiographyMessages(FULL);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("严禁虚构");
    expect(msgs[1].role).toBe("user");
    expect(msgs[1].content).toContain("丁三");
  });
});
