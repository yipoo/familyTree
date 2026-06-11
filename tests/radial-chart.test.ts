import { describe, expect, it } from "vitest";

import {
  layoutRadialChart,
  type RadialParentChild,
  type RadialPerson,
} from "@/lib/services/radial-chart";

// root → a,b → a1,a2 / b1,b2  （3 代 / depth 0..2，共 7 人）
const persons: RadialPerson[] = [
  { id: "root", name: "始祖", gender: "MALE", birthOrder: 1 },
  { id: "a", name: "甲", gender: "MALE", birthOrder: 1 },
  { id: "b", name: "乙", gender: "MALE", birthOrder: 2 },
  { id: "a1", name: "甲一", gender: "MALE", birthOrder: 1 },
  { id: "a2", name: "甲二", gender: "MALE", birthOrder: 2 },
  { id: "b1", name: "乙一", gender: "MALE", birthOrder: 1 },
  { id: "b2", name: "乙二", gender: "MALE", birthOrder: 2 },
];
const pc: RadialParentChild[] = [
  { parentId: "root", childId: "a" },
  { parentId: "root", childId: "b" },
  { parentId: "a", childId: "a1" },
  { parentId: "a", childId: "a2" },
  { parentId: "b", childId: "b1" },
  { parentId: "b", childId: "b2" },
];

describe("layoutRadialChart", () => {
  it("始祖居圆心，逐代成环", () => {
    const c = layoutRadialChart({ rootPersonId: "root", persons, parentChild: pc }, { ringStep: 100 });
    expect(c).not.toBeNull();
    const node = (id: string) => c!.nodes.find((n) => n.id === id)!;
    expect(node("root").depth).toBe(0);
    expect(node("root").x).toBeCloseTo(c!.center);
    expect(node("root").y).toBeCloseTo(c!.center);
    expect(node("a").depth).toBe(1);
    expect(node("a1").depth).toBe(2);
    expect(c!.nodes).toHaveLength(7);
    expect(c!.links).toHaveLength(6);
    expect(c!.rings).toHaveLength(2);
    expect(c!.maxDepth).toBe(2);
    expect(c!.truncated).toBe(false);
  });

  it("环半径 = depth * ringStep", () => {
    const c = layoutRadialChart({ rootPersonId: "root", persons, parentChild: pc }, { ringStep: 100 })!;
    const a = c.nodes.find((n) => n.id === "a")!;
    const dist = Math.hypot(a.x - c.center, a.y - c.center);
    expect(dist).toBeCloseTo(100); // depth 1
    const a1 = c.nodes.find((n) => n.id === "a1")!;
    const dist2 = Math.hypot(a1.x - c.center, a1.y - c.center);
    expect(dist2).toBeCloseTo(200); // depth 2
  });

  it("maxDepth 截断并标记 truncated", () => {
    const c = layoutRadialChart({ rootPersonId: "root", persons, parentChild: pc }, { maxDepth: 1 })!;
    expect(c.maxDepth).toBe(1);
    expect(c.nodes).toHaveLength(3); // root + a + b
    expect(c.truncated).toBe(true);
  });

  it("maxNodes 截断", () => {
    const c = layoutRadialChart({ rootPersonId: "root", persons, parentChild: pc }, { maxNodes: 4 })!;
    expect(c.shown).toBeLessThanOrEqual(4);
    expect(c.truncated).toBe(true);
  });

  it("不存在的 root 返回 null", () => {
    expect(layoutRadialChart({ rootPersonId: "nope", persons, parentChild: pc })).toBeNull();
  });

  it("无环不死循环（数据带环时安全）", () => {
    const cyc: RadialParentChild[] = [
      { parentId: "root", childId: "a" },
      { parentId: "a", childId: "root" }, // 环
    ];
    const c = layoutRadialChart({ rootPersonId: "root", persons, parentChild: cyc })!;
    // root 已 visited，不会因 a→root 再次纳入
    expect(c.nodes.find((n) => n.id === "root")).toBeTruthy();
    expect(c.nodes.filter((n) => n.id === "root")).toHaveLength(1);
  });
});
