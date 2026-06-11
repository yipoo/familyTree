import { describe, expect, it } from "vitest";

import { describePayload, parsePayload } from "@/lib/services/submissions";

describe("parsePayload — person-update（含采集元数据）", () => {
  it("解析 person-update + contributor + source", () => {
    const p = parsePayload({
      kind: "person-update",
      personId: "p1",
      personName: "张三",
      changes: { birthYear: 1950, birthPlace: "李村" },
      source: "collect",
      contributor: { name: "张小四", relation: "本人", phone: "13800000000" },
    });
    expect(p).not.toBeNull();
    expect(p!.kind).toBe("person-update");
    if (p!.kind === "person-update") {
      expect(p!.changes.birthYear).toBe(1950);
    }
    expect(p!.source).toBe("collect");
    expect(p!.contributor?.name).toBe("张小四");
  });

  it("无效来源被丢弃，仍解析", () => {
    const p = parsePayload({
      kind: "person-update",
      personId: "p1",
      personName: "张三",
      changes: {},
      source: "hacker",
    });
    expect(p?.source).toBeUndefined();
  });
});

describe("parsePayload — person-add-child", () => {
  it("解析子女并对非法性别/关系兜底", () => {
    const p = parsePayload({
      kind: "person-add-child",
      parentId: "dad",
      parentName: "张三",
      child: { name: "张小五", gender: "X", birthYear: "1980", relation: "WEIRD" },
      source: "collect",
      contributor: { name: "张三" },
    });
    expect(p).not.toBeNull();
    if (p && p.kind === "person-add-child") {
      expect(p.child.name).toBe("张小五");
      expect(p.child.gender).toBe("UNKNOWN"); // 非法兜底
      expect(p.child.birthYear).toBe(1980); // 字符串转数字
      expect(p.child.relation).toBe("BIOLOGICAL"); // 非法兜底
    }
  });

  it("缺子女姓名返回 null", () => {
    expect(
      parsePayload({
        kind: "person-add-child",
        parentId: "dad",
        parentName: "张三",
        child: { name: "  ", gender: "MALE" },
      }),
    ).toBeNull();
  });
});

describe("describePayload", () => {
  it("person-update 带采集人后缀", () => {
    const s = describePayload({
      kind: "person-update",
      personId: "p1",
      personName: "张三",
      changes: { birthYear: 1950 },
      source: "collect",
      contributor: { name: "张小四", relation: "长子" },
    });
    expect(s).toContain("修改 张三");
    expect(s).toContain("采集自 张小四");
    expect(s).toContain("长子");
  });

  it("person-add-child 描述", () => {
    const s = describePayload({
      kind: "person-add-child",
      parentId: "dad",
      parentName: "张三",
      child: { name: "张小五", gender: "MALE" },
    });
    expect(s).toContain("为 张三 添加子女：张小五");
  });
});
