import { describe, expect, it } from "vitest";

import { buildDetailRows } from "@/lib/services/lineage-chunks";
import type { LineagePerson } from "@/lib/services/lineage-chart";

function person(id: string, generation: number, over: Partial<LineagePerson> = {}): LineagePerson {
  return {
    id,
    name: id.toUpperCase(),
    alias: null,
    generation,
    generationChar: null,
    gender: "MALE",
    isMarriedIn: false,
    birthOrder: 1,
    birthYear: null,
    deathYear: null,
    status: "ALIVE",
    succession: null,
    ...over,
  };
}

/** 用一组 person + 父子边构造 buildDetailRows 的入参。 */
function fixture(
  persons: LineagePerson[],
  edges: [parent: string, child: string][],
  marriages: [husband: string, wife: string][] = [],
) {
  const personById = new Map(persons.map((p) => [p.id, p]));
  const childrenOf = new Map<string, string[]>();
  for (const [p, c] of edges) {
    const arr = childrenOf.get(p) ?? [];
    arr.push(c);
    childrenOf.set(p, arr);
  }
  const wivesOf = new Map<string, string[]>();
  for (const [h, w] of marriages) {
    const arr = wivesOf.get(h) ?? [];
    arr.push(w);
    wivesOf.set(h, arr);
  }
  return { personById, childrenOf, wivesOf };
}

describe("buildDetailRows", () => {
  it("直系链 → 单行、各列连续（col = generation - startGen）", () => {
    const persons = [person("a", 1), person("b", 2), person("c", 3)];
    const { personById, childrenOf, wivesOf } = fixture(persons, [
      ["a", "b"],
      ["b", "c"],
    ]);
    const rows = buildDetailRows("a", 1, new Set(["a", "b", "c"]), childrenOf, personById, wivesOf);
    expect(rows).toHaveLength(1);
    expect(rows[0].map((c) => c.col)).toEqual([0, 1, 2]);
    expect(rows[0].map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("分叉 → 父接第一子行行首，其余兄弟另起一行（前导列留空）", () => {
    const persons = [person("a", 1), person("b", 2), person("c", 2)];
    const { personById, childrenOf, wivesOf } = fixture(persons, [
      ["a", "b"],
      ["a", "c"],
    ]);
    const rows = buildDetailRows("a", 1, new Set(["a", "b", "c"]), childrenOf, personById, wivesOf);
    expect(rows).toHaveLength(2);
    // 行1：a(col0) + b(col1)
    expect(rows[0].map((c) => [c.id, c.col])).toEqual([["a", 0], ["b", 1]]);
    // 行2：仅 c(col1)，col0 留空
    expect(rows[1].map((c) => [c.id, c.col])).toEqual([["c", 1]]);
  });

  it("每行内列号严格递增、单列至多一人", () => {
    // a→{b→{d,e}, c}
    const persons = ["a", "b", "c", "d", "e"].map((id) =>
      person(id, id === "a" ? 1 : id === "b" || id === "c" ? 2 : 3),
    );
    const { personById, childrenOf, wivesOf } = fixture(persons, [
      ["a", "b"],
      ["a", "c"],
      ["b", "d"],
      ["b", "e"],
    ]);
    const rows = buildDetailRows("a", 1, new Set(["a", "b", "c", "d", "e"]), childrenOf, personById, wivesOf);
    for (const row of rows) {
      const cols = row.map((c) => c.col);
      expect([...cols].sort((x, y) => x - y)).toEqual(cols); // 递增
      expect(new Set(cols).size).toBe(cols.length); // 无重复列
    }
    // 全员无丢失
    const ids = rows.flat().map((c) => c.id).sort();
    expect(ids).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("只在 maleSet 内展开（集合外的子嗣不铺）", () => {
    const persons = [person("a", 1), person("b", 2), person("x", 2)];
    const { personById, childrenOf, wivesOf } = fixture(persons, [
      ["a", "b"],
      ["a", "x"],
    ]);
    const rows = buildDetailRows("a", 1, new Set(["a", "b"]), childrenOf, personById, wivesOf);
    const ids = rows.flat().map((c) => c.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).not.toContain("x");
  });

  it("注录字号/生卒，并带上配偶妻名", () => {
    const persons = [
      person("a", 1, { alias: "伯温", birthYear: 1900, deathYear: 1970 }),
      person("w", 1, { name: "王氏", gender: "FEMALE", isMarriedIn: true }),
    ];
    const { personById, childrenOf, wivesOf } = fixture(persons, [], [["a", "w"]]);
    const rows = buildDetailRows("a", 1, new Set(["a"]), childrenOf, personById, wivesOf);
    const cell = rows[0][0];
    expect(cell.annotation).toBe("字伯温 1900—1970");
    expect(cell.wives).toEqual(["王氏"]);
  });
});
