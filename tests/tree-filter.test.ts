import { describe, expect, it } from "vitest";

import {
  EMPTY_FILTER,
  activeFilterCount,
  filterToQuery,
  isFilterEmpty,
  matchesFilter,
  parseFilterFromParams,
  type PersonForFilter,
  type TreeFilter,
} from "@/lib/services/tree-filter";

const person = (over: Partial<PersonForFilter> = {}): PersonForFilter => ({
  id: "p",
  generation: 5,
  generationChar: "賢",
  gender: "MALE",
  status: "ALIVE",
  ...over,
});

describe("tree-filter — empty / active count", () => {
  it("EMPTY_FILTER 是空筛选", () => {
    expect(isFilterEmpty(EMPTY_FILTER)).toBe(true);
    expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
  });

  it("仅设置一个维度，active count = 1", () => {
    const f: TreeFilter = { ...EMPTY_FILTER, locationIds: ["L1"] };
    expect(isFilterEmpty(f)).toBe(false);
    expect(activeFilterCount(f)).toBe(1);
  });

  it("世代上下限合并算 1 个维度", () => {
    const onlyFrom: TreeFilter = { ...EMPTY_FILTER, genFrom: 3 };
    const both: TreeFilter = { ...EMPTY_FILTER, genFrom: 3, genTo: 8 };
    expect(activeFilterCount(onlyFrom)).toBe(1);
    expect(activeFilterCount(both)).toBe(1);
  });

  it("hideUnmatched 不计入 active count（仅是开关）", () => {
    const f: TreeFilter = { ...EMPTY_FILTER, hideUnmatched: true };
    expect(activeFilterCount(f)).toBe(0);
    expect(isFilterEmpty(f)).toBe(true);
  });
});

describe("tree-filter — URL 序列化与反序列化", () => {
  it("空筛选 → 空 query", () => {
    expect(filterToQuery(EMPTY_FILTER)).toEqual({});
  });

  it("完整筛选 → query → 反解，等价", () => {
    const f: TreeFilter = {
      locationIds: ["L1", "L2"],
      generationChars: ["賢", "明"],
      genFrom: 3,
      genTo: 8,
      sexes: ["MALE", "FEMALE"],
      statuses: ["ALIVE"],
      hideUnmatched: true,
    };
    const q = filterToQuery(f);
    expect(q).toMatchObject({
      loc: "L1,L2",
      genChar: "賢,明",
      genFrom: "3",
      genTo: "8",
      sex: "MALE,FEMALE",
      fstatus: "ALIVE",
      hideUnmatched: "1",
    });
    const back = parseFilterFromParams(new URLSearchParams(q));
    expect(back).toEqual(f);
  });

  it("反序列化忽略未知性别 / 状态", () => {
    const params = new URLSearchParams({
      sex: "MALE,XYZ,FEMALE",
      fstatus: "ALIVE,GHOST",
    });
    const f = parseFilterFromParams(params);
    expect(f.sexes).toEqual(["MALE", "FEMALE"]);
    expect(f.statuses).toEqual(["ALIVE"]);
  });

  it("genFrom > genTo 时反序列化自动纠正为升序", () => {
    const params = new URLSearchParams({ genFrom: "10", genTo: "3" });
    const f = parseFilterFromParams(params);
    expect(f.genFrom).toBe(3);
    expect(f.genTo).toBe(10);
  });

  it("非数字的 genFrom/genTo 视为不限", () => {
    const params = new URLSearchParams({ genFrom: "abc", genTo: "" });
    const f = parseFilterFromParams(params);
    expect(f.genFrom).toBeNull();
    expect(f.genTo).toBeNull();
  });

  it("接受 Record<string, string|string[]> 形式（Next.js searchParams）", () => {
    const f = parseFilterFromParams({
      loc: "L1",
      sex: ["MALE"], // 多值时取第一个
    });
    expect(f.locationIds).toEqual(["L1"]);
    expect(f.sexes).toEqual(["MALE"]);
  });
});

describe("tree-filter — matchesFilter 谓词", () => {
  it("空筛选 → 全部匹配", () => {
    expect(matchesFilter(person(), null, EMPTY_FILTER)).toBe(true);
    expect(matchesFilter(person(), "L1", EMPTY_FILTER)).toBe(true);
  });

  it("locationIds：精确 id 匹配；继承居住地也算（传入解析后的 locationId）", () => {
    const f: TreeFilter = { ...EMPTY_FILTER, locationIds: ["L1"] };
    expect(matchesFilter(person(), "L1", f)).toBe(true);
    expect(matchesFilter(person(), "L2", f)).toBe(false);
    expect(matchesFilter(person(), null, f)).toBe(false);
  });

  it("generationChars：必须 person.generationChar 在所选集合中", () => {
    const f: TreeFilter = { ...EMPTY_FILTER, generationChars: ["賢"] };
    expect(matchesFilter(person({ generationChar: "賢" }), null, f)).toBe(true);
    expect(matchesFilter(person({ generationChar: "明" }), null, f)).toBe(false);
    expect(matchesFilter(person({ generationChar: null }), null, f)).toBe(false);
  });

  it("世代范围：闭区间 [genFrom, genTo]", () => {
    const f: TreeFilter = { ...EMPTY_FILTER, genFrom: 3, genTo: 7 };
    expect(matchesFilter(person({ generation: 3 }), null, f)).toBe(true);
    expect(matchesFilter(person({ generation: 7 }), null, f)).toBe(true);
    expect(matchesFilter(person({ generation: 2 }), null, f)).toBe(false);
    expect(matchesFilter(person({ generation: 8 }), null, f)).toBe(false);
  });

  it("仅设置 genFrom 或 genTo 表示单边不限", () => {
    expect(
      matchesFilter(
        person({ generation: 100 }),
        null,
        { ...EMPTY_FILTER, genFrom: 3 },
      ),
    ).toBe(true);
    expect(
      matchesFilter(
        person({ generation: 100 }),
        null,
        { ...EMPTY_FILTER, genTo: 99 },
      ),
    ).toBe(false);
  });

  it("性别多选 = OR", () => {
    const f: TreeFilter = { ...EMPTY_FILTER, sexes: ["MALE", "FEMALE"] };
    expect(matchesFilter(person({ gender: "MALE" }), null, f)).toBe(true);
    expect(matchesFilter(person({ gender: "FEMALE" }), null, f)).toBe(true);
    expect(matchesFilter(person({ gender: "UNKNOWN" }), null, f)).toBe(false);
  });

  it("不同维度之间是 AND", () => {
    const f: TreeFilter = {
      ...EMPTY_FILTER,
      sexes: ["MALE"],
      statuses: ["ALIVE"],
      genFrom: 3,
      genTo: 7,
    };
    // 男 + 在世 + 第 5 代：通过
    expect(
      matchesFilter(
        person({ gender: "MALE", status: "ALIVE", generation: 5 }),
        null,
        f,
      ),
    ).toBe(true);
    // 男 + 已故 + 第 5 代：不通过
    expect(
      matchesFilter(
        person({ gender: "MALE", status: "DECEASED", generation: 5 }),
        null,
        f,
      ),
    ).toBe(false);
  });
});
