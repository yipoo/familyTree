import { describe, expect, it } from "vitest";

import {
  checkFamilyData,
  type CheckMarriage,
  type CheckParentChild,
  type CheckPerson,
} from "@/lib/services/data-check";

const OPTS = { currentYear: 2026 };

function run(
  persons: CheckPerson[],
  parentChild: CheckParentChild[] = [],
  marriages: CheckMarriage[] = [],
) {
  return checkFamilyData({ persons, parentChild, marriages }, OPTS);
}

const codes = (r: ReturnType<typeof run>) => r.issues.map((i) => i.code);

describe("checkFamilyData", () => {
  it("卒年早于生年 → error", () => {
    const r = run([{ id: "a", name: "甲", gender: "MALE", generation: 1, birthYear: 1950, deathYear: 1940 }]);
    expect(codes(r)).toContain("DEATH_BEFORE_BIRTH");
    expect(r.counts.error).toBeGreaterThan(0);
  });

  it("年份越界 → error", () => {
    const r = run([{ id: "a", name: "甲", gender: "MALE", generation: 1, birthYear: 3000 }]);
    expect(codes(r)).toContain("BIRTH_YEAR_RANGE");
  });

  it("享年过高 → warning", () => {
    const r = run([{ id: "a", name: "甲", gender: "MALE", generation: 1, birthYear: 1800, deathYear: 1950 }]);
    expect(codes(r)).toContain("AGE_TOO_HIGH");
  });

  it("父子年龄倒挂 → error；生育过小 → warning", () => {
    const r = run(
      [
        { id: "p", name: "父", gender: "MALE", generation: 1, birthYear: 1950 },
        { id: "c", name: "子", gender: "MALE", generation: 2, birthYear: 1945 },
      ],
      [{ parentId: "p", childId: "c" }],
    );
    expect(codes(r)).toContain("PARENT_NOT_OLDER");

    const r2 = run(
      [
        { id: "p", name: "父", gender: "MALE", generation: 1, birthYear: 1950 },
        { id: "c", name: "子", gender: "MALE", generation: 2, birthYear: 1960 },
      ],
      [{ parentId: "p", childId: "c" }],
    );
    expect(codes(r2)).toContain("PARENTING_TOO_YOUNG");
  });

  it("世代不连续 → warning（STEP 关系豁免）", () => {
    const persons: CheckPerson[] = [
      { id: "p", name: "父", gender: "MALE", generation: 1, birthYear: 1900 },
      { id: "c", name: "子", gender: "MALE", generation: 3, birthYear: 1930 },
    ];
    expect(codes(run(persons, [{ parentId: "p", childId: "c" }]))).toContain("GENERATION_GAP");
    expect(codes(run(persons, [{ parentId: "p", childId: "c", relation: "STEP" }]))).not.toContain(
      "GENERATION_GAP",
    );
  });

  it("多于一个生父 → warning", () => {
    const r = run(
      [
        { id: "d1", name: "父1", gender: "MALE", generation: 1, birthYear: 1900 },
        { id: "d2", name: "父2", gender: "MALE", generation: 1, birthYear: 1901 },
        { id: "c", name: "子", gender: "MALE", generation: 2, birthYear: 1930 },
      ],
      [
        { parentId: "d1", childId: "c" },
        { parentId: "d2", childId: "c" },
      ],
    );
    expect(codes(r)).toContain("MULTIPLE_FATHERS");
  });

  it("疑似重复（同名同辈同生年）→ error；同辈同名 → warning", () => {
    const dup = run([
      { id: "a", name: "丁三", gender: "MALE", generation: 5, birthYear: 1901 },
      { id: "b", name: "丁三", gender: "MALE", generation: 5, birthYear: 1901 },
    ]);
    expect(codes(dup)).toContain("DUPLICATE_PERSON");

    const sameName = run([
      { id: "a", name: "丁三", gender: "MALE", generation: 5, birthYear: 1901 },
      { id: "b", name: "丁三", gender: "MALE", generation: 5, birthYear: 1950 },
    ]);
    expect(codes(sameName)).toContain("SAME_NAME_GENERATION");
    expect(codes(sameName)).not.toContain("DUPLICATE_PERSON");
  });

  it("自环 / 自婚 → error", () => {
    expect(codes(run([{ id: "a", name: "甲", gender: "MALE", generation: 1 }], [{ parentId: "a", childId: "a" }]))).toContain("SELF_PARENT");
    expect(codes(run([{ id: "a", name: "甲", gender: "MALE", generation: 1 }], [], [{ husbandId: "a", wifeId: "a" }]))).toContain("SELF_MARRIAGE");
  });

  it("干净数据无 error/warning", () => {
    const r = run(
      [
        { id: "p", name: "父", gender: "MALE", generation: 1, birthYear: 1900, deathYear: 1970 },
        { id: "c", name: "子", gender: "MALE", generation: 2, birthYear: 1930 },
      ],
      [{ parentId: "p", childId: "c" }],
    );
    expect(r.counts.error).toBe(0);
    expect(r.counts.warning).toBe(0);
    expect(r.checked).toBe(2);
  });
});
