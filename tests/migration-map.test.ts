import { describe, expect, it } from "vitest";

import {
  layoutMigrationFlow,
  resolveResidenceCounts,
  shortLocationName,
  FLOW_NODE_W,
  type FlowEdgeIn,
  type FlowNodeIn,
} from "@/lib/services/migration-map";

describe("layoutMigrationFlow", () => {
  const nodes: FlowNodeIn[] = [
    { id: "jy", name: "济阳", count: 0 },
    { id: "dg", name: "东关", count: 3 },
    { id: "cg", name: "陈沟", count: 100 },
    { id: "tq", name: "塔桥", count: 50 },
    { id: "isolated", name: "孤立地点" },
  ];
  const edges: FlowEdgeIn[] = [
    { fromId: "jy", toId: "dg", label: "明初调宿", subject: "始祖太公" },
    { fromId: "dg", toId: "cg", label: "分门徙居", subject: "二门" },
    { fromId: "dg", toId: "tq", label: "分门徙居", subject: "长门" },
  ];

  it("拓扑分层：济阳=0 列、东关=1 列、陈沟/塔桥=2 列；孤立地点不进图", () => {
    const l = layoutMigrationFlow(nodes, edges);
    const colOf = (id: string) => l.nodes.find((n) => n.id === id)?.col;
    expect(colOf("jy")).toBe(0);
    expect(colOf("dg")).toBe(1);
    expect(colOf("cg")).toBe(2);
    expect(colOf("tq")).toBe(2);
    expect(l.nodes.find((n) => n.id === "isolated")).toBeUndefined();
    expect(l.edges).toHaveLength(3);
  });

  it("扇出列纵向堆叠，单节点列垂直居中", () => {
    const l = layoutMigrationFlow(nodes, edges);
    const cg = l.nodes.find((n) => n.id === "cg")!;
    const tq = l.nodes.find((n) => n.id === "tq")!;
    expect(cg.y).not.toBe(tq.y); // 同列两行
    const jy = l.nodes.find((n) => n.id === "jy")!;
    expect(jy.y).toBeGreaterThan(0); // 单节点列被垂直居中
    expect(l.width).toBeGreaterThan(FLOW_NODE_W * 3);
  });

  it("空输入 → 空布局不崩", () => {
    const l = layoutMigrationFlow([], []);
    expect(l.nodes).toHaveLength(0);
    expect(l.edges).toHaveLength(0);
  });

  it("环数据可终止（A→B→A）", () => {
    const l = layoutMigrationFlow(
      [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      [
        { fromId: "a", toId: "b", label: "x", subject: "s" },
        { fromId: "b", toId: "a", label: "y", subject: "s" },
      ],
    );
    expect(l.nodes).toHaveLength(2);
  });
});

describe("resolveResidenceCounts", () => {
  it("本人未填沿父系继承；嫁入女子随夫", () => {
    const persons = [
      { id: "f", residenceId: "locA", gender: "MALE" as const, isMarriedIn: false },
      { id: "s", residenceId: null, gender: "MALE" as const, isMarriedIn: false }, // 子承父 locA
      { id: "w", residenceId: null, gender: "FEMALE" as const, isMarriedIn: true }, // 妻随夫 locA
      { id: "g", residenceId: "locB", gender: "MALE" as const, isMarriedIn: false }, // 自有 locB
    ];
    const pc = [{ parentId: "f", childId: "s" }];
    const mar = [{ husbandId: "s", wifeId: "w" }];
    const c = resolveResidenceCounts(persons, pc, mar);
    expect(c.get("locA")).toBe(3); // f + s + w
    expect(c.get("locB")).toBe(1);
  });

  it("无可继承 → 不计入；环防护不死循环", () => {
    const persons = [
      { id: "x", residenceId: null, gender: "MALE" as const, isMarriedIn: false },
      { id: "y", residenceId: null, gender: "MALE" as const, isMarriedIn: false },
    ];
    // 病态环：x 的父是 y、y 的父是 x
    const pc = [
      { parentId: "y", childId: "x" },
      { parentId: "x", childId: "y" },
    ];
    const c = resolveResidenceCounts(persons, pc, []);
    expect(c.size).toBe(0);
  });
});

describe("shortLocationName", () => {
  it("村 > 镇 > 县 > 市 > ·后段 > fullText", () => {
    expect(shortLocationName({ fullText: "x", village: "陈沟" })).toBe("陈沟");
    expect(shortLocationName({ fullText: "x", town: "符离镇" })).toBe("符离镇");
    expect(shortLocationName({ fullText: "安徽省宿州市埇桥区·东关" })).toBe("东关");
    expect(shortLocationName({ fullText: "丁河套" })).toBe("丁河套");
  });
});
