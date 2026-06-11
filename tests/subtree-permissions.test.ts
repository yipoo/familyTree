/**
 * 子树管理员权限闭环测试。
 *
 * 测试家族骨架：
 *
 *   GA (root)
 *    ├─ P1
 *    │   ├─ ROOT_A
 *    │   │   └─ C_A
 *    │   └─ B_A
 *    └─ P2
 *        ├─ ROOT_B
 *        └─ MARRIED_W (嫁入女性)
 *            └─ NESTED （挂在 MARRIED_W 名下）
 *
 * 子树管理员被授权 ROOT_A 时：
 *   - 可写 ROOT_A 自己 ✅
 *   - 可写 ROOT_A 的儿子 C_A ✅
 *   - 不可写 ROOT_A 的兄弟 B_A ❌（不在 ROOT_A 子树）
 *   - 不可写 P1（ROOT_A 的父亲）❌
 *   - 不可写 ROOT_B ❌（旁系完全不同支）
 *   - 不可写嫁入女性 MARRIED_W 的下属 NESTED ❌（嫁入处链断）
 *
 * OWNER / ADMIN：可写所有人；GUEST / 无成员关系：不可写。
 */
import { describe, expect, it } from "vitest";

import {
  computePaternalChain,
  judgeSubtreeWrite,
} from "@/lib/auth/subtree";

// 邻接：child → father（仅父系 + isPrimary）
const fatherOf = new Map<string, string>([
  ["P1", "GA"],
  ["P2", "GA"],
  ["ROOT_A", "P1"],
  ["B_A", "P1"],
  ["C_A", "ROOT_A"],
  ["ROOT_B", "P2"],
  ["MARRIED_W", "EXT_FATHER"], // MARRIED_W 的父亲不在本家族
  // NESTED 的父亲不是 MARRIED_W（女性不参与 fatherOf），
  // 测试场景：NESTED 没有男性父亲，于是链条只有 NESTED 自己
]);

const isMarriedIn = new Map<string, boolean>([
  ["MARRIED_W", true],
]);

describe("computePaternalChain", () => {
  it("普通直系链一直追到根", () => {
    expect(computePaternalChain("C_A", fatherOf, isMarriedIn)).toEqual([
      "C_A",
      "ROOT_A",
      "P1",
      "GA",
    ]);
  });

  it("旁系链各走各的", () => {
    expect(computePaternalChain("B_A", fatherOf, isMarriedIn)).toEqual([
      "B_A",
      "P1",
      "GA",
    ]);
    expect(computePaternalChain("ROOT_B", fatherOf, isMarriedIn)).toEqual([
      "ROOT_B",
      "P2",
      "GA",
    ]);
  });

  it("嫁入女性是链的终点", () => {
    expect(computePaternalChain("MARRIED_W", fatherOf, isMarriedIn)).toEqual([
      "MARRIED_W",
    ]);
  });

  it("无父无子的孤儿只返回自己", () => {
    expect(
      computePaternalChain("LONE", fatherOf, isMarriedIn),
    ).toEqual(["LONE"]);
  });
});

describe("judgeSubtreeWrite — 子树管理员只能改自己负责的支系内人物", () => {
  function judge(opts: {
    grants: string[];
    target: string;
    role?: "OWNER" | "ADMIN" | "MEMBER" | "GUEST" | null;
    isSuperAdmin?: boolean;
  }) {
    return judgeSubtreeWrite({
      role: opts.role ?? null,
      isSuperAdmin: !!opts.isSuperAdmin,
      grants: opts.grants,
      targetPersonId: opts.target,
      fatherOf,
      isMarriedIn,
    });
  }

  it("子树管理员可写自己 / 可写后代", () => {
    expect(judge({ grants: ["ROOT_A"], target: "ROOT_A" })).toBe(true);
    expect(judge({ grants: ["ROOT_A"], target: "C_A" })).toBe(true);
  });

  it("子树管理员不可写兄弟 / 不可写父亲", () => {
    expect(judge({ grants: ["ROOT_A"], target: "B_A" })).toBe(false);
    expect(judge({ grants: ["ROOT_A"], target: "P1" })).toBe(false);
  });

  it("子树管理员不可写其他支系", () => {
    expect(judge({ grants: ["ROOT_A"], target: "ROOT_B" })).toBe(false);
  });

  it("根 GA 的授权可以覆盖整个家族", () => {
    expect(judge({ grants: ["GA"], target: "C_A" })).toBe(true);
    expect(judge({ grants: ["GA"], target: "ROOT_B" })).toBe(true);
  });

  it("无授权 / 无成员 → 一律拒绝", () => {
    expect(judge({ grants: [], target: "C_A" })).toBe(false);
    expect(judge({ grants: [], target: "GA" })).toBe(false);
  });

  it("OWNER / ADMIN 不需要 grant，全可写", () => {
    expect(judge({ role: "OWNER", grants: [], target: "C_A" })).toBe(true);
    expect(judge({ role: "ADMIN", grants: [], target: "ROOT_B" })).toBe(true);
  });

  it("MEMBER / GUEST 没有 grant 时一律拒绝", () => {
    expect(judge({ role: "MEMBER", grants: [], target: "C_A" })).toBe(false);
    expect(judge({ role: "GUEST", grants: [], target: "C_A" })).toBe(false);
  });

  it("SUPERADMIN 总是可写", () => {
    expect(
      judge({ isSuperAdmin: true, role: null, grants: [], target: "C_A" }),
    ).toBe(true);
  });

  it("嫁入女性下面挂载的人物：链断在 MARRIED_W，向上的祖先无法授权", () => {
    // 设想 NESTED 在 MARRIED_W 名下，但 NESTED 自己没有 fatherOf 记录（非男性父亲）
    expect(judge({ grants: ["GA"], target: "NESTED" })).toBe(false);
    expect(judge({ grants: ["MARRIED_W"], target: "NESTED" })).toBe(false);
  });
});
