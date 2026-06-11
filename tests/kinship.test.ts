/**
 * kin5 边界测试。
 *
 * 标准家族骨架（ASCII，仅父系链）：
 *
 *   GA - GA_w        GB - GB_w
 *      |                |
 *      P --------------- M(w)
 *      |
 *   ┌──+──┐
 *   B1   ROOT - ROOT_w
 *        |
 *      ┌─+─┐
 *     C1   C2
 *      |
 *      G1
 *
 *   B1 是 root 的兄弟，有 子 N1（侄）
 *   C1 子 G1（孙）
 *
 * kin5 应包含：GA, GA_w, GB, GB_w, P, M, ROOT, ROOT_w, B1, B1_w (若有), N1, C1, C2, G1
 *
 * 不应包含：堂兄弟、姑舅、曾祖、曾孙等更远的亲属。
 */
import { describe, expect, it } from "vitest";

import { computeKin5, type KinParentChild, type KinPerson } from "@/lib/services/kinship";

function p(id: string, gender: "MALE" | "FEMALE" = "MALE"): KinPerson {
  return { id, gender };
}

describe("computeKin5", () => {
  it("以 root 为中心扩 2 代直系 + 兄弟 + 各级配偶", () => {
    const persons: KinPerson[] = [
      p("GA"), p("GA_w", "FEMALE"),
      p("GB"), p("GB_w", "FEMALE"),
      p("P"), p("M", "FEMALE"),
      p("B1"), p("ROOT"),
      p("ROOT_w", "FEMALE"),
      p("C1"), p("C2"),
      p("G1"),
      p("N1"),
      // 旁系：堂兄弟，应该被排除
      p("UNCLE"), p("COUSIN"),
      // 曾祖（上 3 代），应该被排除
      p("GGA"),
    ];
    const parentChild: KinParentChild[] = [
      { parentId: "GGA", childId: "GA" },
      { parentId: "GA", childId: "P" },
      { parentId: "GA_w", childId: "P" },
      { parentId: "GB", childId: "M" },
      { parentId: "GB_w", childId: "M" },
      { parentId: "P", childId: "B1" },
      { parentId: "P", childId: "ROOT" },
      { parentId: "M", childId: "B1" },
      { parentId: "M", childId: "ROOT" },
      { parentId: "ROOT", childId: "C1" },
      { parentId: "ROOT", childId: "C2" },
      { parentId: "ROOT_w", childId: "C1" },
      { parentId: "ROOT_w", childId: "C2" },
      { parentId: "C1", childId: "G1" },
      // 旁系污染源：UNCLE 是 GA 的儿子（root 的伯父），COUSIN 是 UNCLE 的儿子（root 的堂兄）
      { parentId: "GA", childId: "UNCLE" },
      { parentId: "UNCLE", childId: "COUSIN" },
      // B1 的儿子 N1（侄）
      { parentId: "B1", childId: "N1" },
    ];
    const marriages = [
      { husbandId: "GA", wifeId: "GA_w" },
      { husbandId: "GB", wifeId: "GB_w" },
      { husbandId: "P", wifeId: "M" },
      { husbandId: "ROOT", wifeId: "ROOT_w" },
    ];

    const r = computeKin5({
      rootPersonId: "ROOT",
      persons,
      parentChild,
      marriages,
    });

    // 应包含
    for (const id of [
      "GA", "GA_w", "GB", "GB_w",
      "P", "M",
      "B1", "ROOT", "ROOT_w",
      "C1", "C2", "G1",
      "N1",
    ]) {
      expect(r.ids.has(id), `应包含 ${id}`).toBe(true);
    }
    // 不应包含
    for (const id of ["UNCLE", "COUSIN", "GGA"]) {
      expect(r.ids.has(id), `不应包含 ${id}`).toBe(false);
    }

    // 关键边都被允许
    expect(r.edges.has("P::ROOT")).toBe(true);
    expect(r.edges.has("M::ROOT")).toBe(true);
    expect(r.edges.has("ROOT::C1")).toBe(true);
    expect(r.edges.has("C1::G1")).toBe(true);
    expect(r.edges.has("GA::P")).toBe(true);
    expect(r.edges.has("P::B1")).toBe(true);
    expect(r.edges.has("B1::N1")).toBe(true);
  });

  it("无父无子的孤儿 root 只返回他自己", () => {
    const persons = [p("X")];
    const r = computeKin5({
      rootPersonId: "X",
      persons,
      parentChild: [],
      marriages: [],
    });
    expect(r.ids.size).toBe(1);
    expect(r.ids.has("X")).toBe(true);
    expect(r.edges.size).toBe(0);
  });

  it("多婚配：所有配偶都纳入", () => {
    const persons = [
      p("ROOT"),
      p("W1", "FEMALE"),
      p("W2", "FEMALE"),
    ];
    const r = computeKin5({
      rootPersonId: "ROOT",
      persons,
      parentChild: [],
      marriages: [
        { husbandId: "ROOT", wifeId: "W1" },
        { husbandId: "ROOT", wifeId: "W2" },
      ],
    });
    expect(r.ids.has("W1")).toBe(true);
    expect(r.ids.has("W2")).toBe(true);
  });

  it("不存在的 root 返回空集", () => {
    const r = computeKin5({
      rootPersonId: "NOPE",
      persons: [p("A")],
      parentChild: [],
      marriages: [],
    });
    expect(r.ids.size).toBe(0);
    expect(r.edges.size).toBe(0);
  });

  it("入赘场景：女性 root 的女方家庭也算近亲", () => {
    // 女 root，女方父母 + 入赘的丈夫 + 子女
    const persons = [
      p("ROOT", "FEMALE"),
      p("FATHER"), p("MOTHER", "FEMALE"),
      p("HUSBAND"),
      p("CHILD"),
    ];
    const r = computeKin5({
      rootPersonId: "ROOT",
      persons,
      parentChild: [
        { parentId: "FATHER", childId: "ROOT" },
        { parentId: "MOTHER", childId: "ROOT" },
        { parentId: "ROOT", childId: "CHILD" },
        { parentId: "HUSBAND", childId: "CHILD" },
      ],
      marriages: [{ husbandId: "HUSBAND", wifeId: "ROOT" }],
    });
    expect(r.ids.has("FATHER")).toBe(true);
    expect(r.ids.has("MOTHER")).toBe(true);
    expect(r.ids.has("HUSBAND")).toBe(true);
    expect(r.ids.has("CHILD")).toBe(true);
  });
});
