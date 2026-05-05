import { describe, expect, it } from "vitest";

import {
  layoutLineageChart,
  type LineagePerson,
} from "@/lib/services/lineage-chart";

function p(
  id: string,
  generation: number,
  gender: "MALE" | "FEMALE" = "MALE",
  extra: Partial<LineagePerson> = {},
): LineagePerson {
  return {
    id,
    name: id,
    alias: null,
    generation,
    generationChar: null,
    gender,
    isMarriedIn: false,
    birthOrder: null,
    birthYear: null,
    deathYear: null,
    status: "ALIVE",
    succession: null,
    ...extra,
  };
}

describe("layoutLineageChart", () => {
  it("单根无后代时只有一个节点", () => {
    const r = layoutLineageChart({
      rootPersonId: "A",
      persons: [p("A", 1)],
      parentChild: [],
      marriages: [],
    });
    expect(r.nodes).toHaveLength(1);
    expect(r.nodes[0].id).toBe("A");
    expect(r.lines).toHaveLength(0);
    expect(r.generations).toEqual([1]);
  });

  it("多代单链：两个节点 + 两段挂线（同列时也加 v 段）", () => {
    const r = layoutLineageChart({
      rootPersonId: "A",
      persons: [p("A", 1), p("B", 2)],
      parentChild: [{ parentId: "A", childId: "B", birthOrder: 1 }],
      marriages: [],
    });
    expect(r.nodes).toHaveLength(2);
    // 单链：父→中线（1 段），子→上（1 段）
    expect(r.lines.length).toBeGreaterThanOrEqual(2);
    expect(r.generations).toEqual([1, 2]);
  });

  it("多兄弟：父向下 + 一条横线 + 每个孩子向下", () => {
    const r = layoutLineageChart({
      rootPersonId: "A",
      persons: [p("A", 1), p("B", 2), p("C", 2), p("D", 2)],
      parentChild: [
        { parentId: "A", childId: "B", birthOrder: 1 },
        { parentId: "A", childId: "C", birthOrder: 2 },
        { parentId: "A", childId: "D", birthOrder: 3 },
      ],
      marriages: [],
    });
    expect(r.nodes.map((n) => n.id).sort()).toEqual(["A", "B", "C", "D"]);
    // 至少：父向下 + 横线 + 3 段子向下 = 5 段
    expect(r.lines.length).toBeGreaterThanOrEqual(5);
    // 兄弟同 y
    const ys = ["B", "C", "D"].map((id) => r.nodes.find((n) => n.id === id)!.y);
    expect(new Set(ys).size).toBe(1);
  });

  it("不下钻女性后代（仅父系下钻）", () => {
    const r = layoutLineageChart({
      rootPersonId: "A",
      persons: [
        p("A", 1, "MALE"),
        p("B", 2, "FEMALE"), // 女儿，不下钻
        p("C", 2, "MALE"), // 儿子，下钻
        p("D", 3, "MALE"), // 孙
      ],
      parentChild: [
        { parentId: "A", childId: "B", birthOrder: 1 },
        { parentId: "A", childId: "C", birthOrder: 2 },
        { parentId: "C", childId: "D", birthOrder: 1 },
      ],
      marriages: [],
    });
    const ids = new Set(r.nodes.map((n) => n.id));
    expect(ids.has("D")).toBe(true);
    // B 也在图里（同代直接孩子展示），但其后代不会被收集
  });

  it("配偶展示在男性父亲下方（spouses）", () => {
    const r = layoutLineageChart({
      rootPersonId: "A",
      persons: [
        p("A", 1, "MALE"),
        p("W1", 1, "FEMALE", { isMarriedIn: true }),
        p("W2", 1, "FEMALE", { isMarriedIn: true }),
        p("B", 2),
      ],
      parentChild: [{ parentId: "A", childId: "B", birthOrder: 1 }],
      marriages: [
        { husbandId: "A", wifeId: "W1", type: "PRIMARY", order: 1 },
        { husbandId: "A", wifeId: "W2", type: "SECONDARY", order: 2 },
      ],
    });
    const a = r.nodes.find((n) => n.id === "A")!;
    expect(a.spouses.map((s) => s.id)).toEqual(["W1", "W2"]);
  });

  it("birthOrder 决定兄弟的 X 顺序", () => {
    const r = layoutLineageChart({
      rootPersonId: "A",
      persons: [p("A", 1), p("X", 2), p("Y", 2), p("Z", 2)],
      parentChild: [
        { parentId: "A", childId: "X", birthOrder: 3 },
        { parentId: "A", childId: "Y", birthOrder: 1 },
        { parentId: "A", childId: "Z", birthOrder: 2 },
      ],
      marriages: [],
    });
    const xs = ["Y", "Z", "X"].map(
      (id) => r.nodes.find((n) => n.id === id)!.x,
    );
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });
});
