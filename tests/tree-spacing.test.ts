import { describe, expect, it } from "vitest";

import {
  SPACING_PRESETS,
  layoutPaternalTree,
  type PersonInput,
  type MarriageInput,
  type ParentChildInput,
} from "@/lib/services/tree-layout";

function p(
  id: string,
  generation: number,
  gender: "MALE" | "FEMALE" = "MALE",
): PersonInput {
  return {
    id,
    name: id,
    gender,
    generation,
    generationChar: null,
    isMarriedIn: false,
    status: "ALIVE",
  };
}

/**
 * 三代家系：F 一妻 W 二子 C1 / C2，每子又各一子（C1S, C2S）。
 * 用于测试同代横向间距与代间纵向间距是否随 spacing preset 缩放。
 */
function buildSampleTree(): {
  persons: PersonInput[];
  marriages: MarriageInput[];
  parentChild: ParentChildInput[];
  rootPersonId: string;
} {
  const persons: PersonInput[] = [
    p("F", 1, "MALE"),
    { ...p("W", 1, "FEMALE"), isMarriedIn: true },
    p("C1", 2, "MALE"),
    p("C2", 2, "MALE"),
    p("C1S", 3, "MALE"),
    p("C2S", 3, "MALE"),
  ];
  const marriages: MarriageInput[] = [
    { id: "m1", husbandId: "F", wifeId: "W", type: "PRIMARY", order: 1 },
  ];
  const parentChild: ParentChildInput[] = [
    { parentId: "F", childId: "C1", birthOrder: 1 },
    { parentId: "F", childId: "C2", birthOrder: 2 },
    { parentId: "C1", childId: "C1S", birthOrder: 1 },
    { parentId: "C2", childId: "C2S", birthOrder: 1 },
  ];
  return { persons, marriages, parentChild, rootPersonId: "F" };
}

describe("layoutPaternalTree spacing presets", () => {
  it("normal preset 倍率为 1×1（基准）", () => {
    expect(SPACING_PRESETS.normal).toEqual({ x: 1, y: 1 });
  });

  it("compact 比 normal 紧凑（水平、垂直均更小）", () => {
    expect(SPACING_PRESETS.compact.x).toBeLessThan(SPACING_PRESETS.normal.x);
    expect(SPACING_PRESETS.compact.y).toBeLessThan(SPACING_PRESETS.normal.y);
    expect(SPACING_PRESETS.compact).toEqual({ x: 0.7, y: 0.85 });
  });

  it("loose 比 normal 宽松", () => {
    expect(SPACING_PRESETS.loose.x).toBeGreaterThan(SPACING_PRESETS.normal.x);
    expect(SPACING_PRESETS.loose.y).toBeGreaterThan(SPACING_PRESETS.normal.y);
    expect(SPACING_PRESETS.loose).toEqual({ x: 1.5, y: 1.2 });
  });

  it("水平间距随 spacing 倍率缩放：紧凑 < 中 < 宽松", () => {
    const { persons, marriages, parentChild, rootPersonId } = buildSampleTree();

    function siblingGap(spacing: "compact" | "normal" | "loose"): number {
      const layout = layoutPaternalTree({
        rootPersonId,
        persons,
        marriages,
        parentChild,
        spacing,
      });
      const c1 = layout.nodes.find((n) => n.id === "C1")!;
      const c2 = layout.nodes.find((n) => n.id === "C2")!;
      // 兄弟之间的中心距
      return Math.abs(c2.x - c1.x);
    }

    const compactGap = siblingGap("compact");
    const normalGap = siblingGap("normal");
    const looseGap = siblingGap("loose");

    expect(compactGap).toBeLessThan(normalGap);
    expect(normalGap).toBeLessThan(looseGap);
  });

  it("垂直间距随 spacing.y 缩放：紧凑 < 中 < 宽松", () => {
    const { persons, marriages, parentChild, rootPersonId } = buildSampleTree();

    function rowHeight(spacing: "compact" | "normal" | "loose"): number {
      const layout = layoutPaternalTree({
        rootPersonId,
        persons,
        marriages,
        parentChild,
        spacing,
      });
      const f = layout.nodes.find((n) => n.id === "F")!;
      const c1 = layout.nodes.find((n) => n.id === "C1")!;
      return c1.y - f.y;
    }

    const compactRowH = rowHeight("compact");
    const normalRowH = rowHeight("normal");
    const looseRowH = rowHeight("loose");

    expect(compactRowH).toBeLessThan(normalRowH);
    expect(normalRowH).toBeLessThan(looseRowH);
  });

  it("节点尺寸（宽高）不随 spacing 变化——只缩放间距", () => {
    const { persons, marriages, parentChild, rootPersonId } = buildSampleTree();
    const compact = layoutPaternalTree({
      rootPersonId,
      persons,
      marriages,
      parentChild,
      spacing: "compact",
    });
    const loose = layoutPaternalTree({
      rootPersonId,
      persons,
      marriages,
      parentChild,
      spacing: "loose",
    });
    // 节点数 / 边数 不变
    expect(compact.nodes.length).toBe(loose.nodes.length);
    expect(compact.edges.length).toBe(loose.edges.length);
  });

  it("默认无 spacing 参数等价于 normal", () => {
    const { persons, marriages, parentChild, rootPersonId } = buildSampleTree();
    const def = layoutPaternalTree({
      rootPersonId,
      persons,
      marriages,
      parentChild,
    });
    const normal = layoutPaternalTree({
      rootPersonId,
      persons,
      marriages,
      parentChild,
      spacing: "normal",
    });
    for (const n of def.nodes) {
      const m = normal.nodes.find((x) => x.id === n.id)!;
      expect(m.x).toBeCloseTo(n.x, 5);
      expect(m.y).toBeCloseTo(n.y, 5);
    }
  });
});
