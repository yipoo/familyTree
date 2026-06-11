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

import { packLineageChunks, type LineageChunk } from "@/lib/services/lineage-chunks";

function mkChunk(id: string, persons: number): LineageChunk {
  return {
    index: 0, rootId: id, rootName: id, startGen: 1,
    maleIds: Array.from({ length: persons }, (_, i) => `${id}-${i}`),
    layout: { nodes: [], lines: [], generations: [], yByGen: {}, width: 100, height: 100 } as never,
    continuationCount: 0, continuationIds: [], detailRows: [],
    vertical: { nodes: [], links: [], width: 0, height: 0, rows: 0, startGen: 1 },
  };
}

describe("packLineageChunks", () => {
  it("小块按序合并，超人数或超块数即断组", () => {
    const packs = packLineageChunks(
      [mkChunk("a", 10), mkChunk("b", 10), mkChunk("c", 15), mkChunk("d", 5)],
      { maxPersons: 30, maxChunks: 3 },
    );
    // a+b=20，再加 c=35 超 → [a,b] [c,d]
    expect(packs.map((p) => p.chunks.map((c) => c.rootId))).toEqual([["a", "b"], ["c", "d"]]);
    expect(packs[0].persons).toBe(20);
    expect(packs[1].persons).toBe(20);
  });

  it("大块独占一组；块数上限生效", () => {
    const packs = packLineageChunks(
      [mkChunk("big", 40), mkChunk("a", 3), mkChunk("b", 3), mkChunk("c", 3), mkChunk("d", 3)],
      { maxPersons: 30, maxChunks: 3 },
    );
    expect(packs[0].chunks.map((c) => c.rootId)).toEqual(["big"]);
    expect(packs[1].chunks).toHaveLength(3); // a b c（块数上限）
    expect(packs[2].chunks.map((c) => c.rootId)).toEqual(["d"]);
    expect(packs.map((p) => p.index)).toEqual([1, 2, 3]);
  });

  it("空输入 → 空", () => {
    expect(packLineageChunks([])).toEqual([]);
  });
});

import { layoutVerticalChunk, V_COL_W, V_CHAR_H } from "@/lib/services/lineage-chunks";

function vp(id: string, name: string, generation: number): LineagePerson {
  return { id, name, alias: null, generation, generationChar: null, gender: "MALE", isMarriedIn: false, birthOrder: null, birthYear: null, deathYear: null, status: "ALIVE", succession: null };
}

describe("layoutVerticalChunk（竖排吊线布局）", () => {
  // 祖 r → 子 a、b；a → 孙 a1
  const personById = new Map([
    ["r", vp("r", "始祖", 1)],
    ["a", vp("a", "长子", 2)],
    ["b", vp("b", "次子", 2)],
    ["a1", vp("a1", "长孙", 3)],
  ]);
  const childrenOf = new Map([
    ["r", ["a", "b"]],
    ["a", ["a1"]],
  ]);
  const males = new Set(["r", "a", "b", "a1"]);

  it("父居诸子中点上方；叶子等距；行随世代", () => {
    const v = layoutVerticalChunk("r", males, childrenOf, personById, new Set());
    const at = (id: string) => v.nodes.find((n) => n.id === id)!;
    expect(at("a1").x).toBe(at("a").x); // 独孙与父同列
    expect(at("r").x).toBeCloseTo((at("a").x + at("b").x) / 2); // 父居中
    expect(at("a").x - at("b").x).toBe(V_COL_W); // 长子居右（传统谱右起），叶距一列
    expect(at("a").y).toBeGreaterThan(at("r").y); // 子行在下
    expect(v.rows).toBe(3);
  });

  it("连线从父名底部起（线长随名字长短变化），无框", () => {
    const v = layoutVerticalChunk("r", males, childrenOf, personById, new Set());
    const at = (id: string) => v.nodes.find((n) => n.id === id)!;
    const drop = v.links.find((l) => l.x1 === at("r").x && l.x2 === at("r").x && l.y1 > at("r").y);
    expect(drop).toBeTruthy();
    expect(drop!.y1).toBe(at("r").y + 2 * V_CHAR_H + 2); // "始祖"两字名 → 线自两字之下起
  });

  it("续接点带标记", () => {
    const v = layoutVerticalChunk("r", males, childrenOf, personById, new Set(["a1"]));
    expect(v.nodes.find((n) => n.id === "a1")!.isContinuation).toBe(true);
    expect(v.nodes.find((n) => n.id === "r")!.isContinuation).toBe(false);
  });
});

describe("layoutVerticalChunk·标尺与长幼序", () => {
  const personById = new Map([
    ["r", { id: "r", name: "始祖", alias: null, generation: 6, generationChar: null, gender: "MALE" as const, isMarriedIn: false, birthOrder: null, birthYear: null, deathYear: null, status: "ALIVE", succession: null }],
    ["a", { id: "a", name: "长子", alias: null, generation: 7, generationChar: null, gender: "MALE" as const, isMarriedIn: false, birthOrder: null, birthYear: null, deathYear: null, status: "ALIVE", succession: null }],
    ["b", { id: "b", name: "次子", alias: null, generation: 7, generationChar: null, gender: "MALE" as const, isMarriedIn: false, birthOrder: null, birthYear: null, deathYear: null, status: "ALIVE", succession: null }],
  ]);
  it("startGen=根世（标尺自根世起，而非最深叶）", () => {
    const v = layoutVerticalChunk("r", new Set(["r", "a", "b"]), new Map([["r", ["a", "b"]]]), personById, new Set());
    expect(v.startGen).toBe(6);
  });
});
