/**
 * 三式（欧式 / 苏式 / 宝塔式）共用的家族树数据：
 *   - personById：id → 人物
 *   - childrenOf：父 id → 子 id 列表（按 ParentChild.birthOrder 升序，长子在前）
 *   - rootIds：在本家族内无父记录的人物（每个分支头）
 *
 * 与 lib/services/tree-layout / lineage-chart 不同，这里输出"自然顺序"
 * （长子先），便于以表格 / 缩进列表展示。
 */

export interface TreePerson {
  id: string;
  name: string;
  alias: string | null;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  generation: number;
  generationChar: string | null;
  birthOrder: number | null;
  birthYear: number | null;
  deathYear: number | null;
  isMarriedIn: boolean;
}

export interface TreeEdge {
  parentId: string;
  childId: string;
  birthOrder: number | null;
}

export interface TreeMarriage {
  husbandId: string;
  wifeId: string;
  type: string;
  order: number;
}

export interface TreeData {
  personById: Map<string, TreePerson>;
  childrenOf: Map<string, string[]>;
  /** 配偶（妻子）id 列表 */
  spousesOf: Map<string, string[]>;
  rootIds: string[];
}

export function buildTreeData(input: {
  persons: TreePerson[];
  parentChild: TreeEdge[];
  marriages: TreeMarriage[];
}): TreeData {
  const personById = new Map(input.persons.map((p) => [p.id, p]));

  // 父→子（按 birthOrder 升序，长子在前；同 birthOrder 看不出来就按 id 稳定）
  const childrenOf = new Map<string, string[]>();
  const sortedEdges = [...input.parentChild].sort((a, b) => {
    const av = a.birthOrder ?? Number.POSITIVE_INFINITY;
    const bv = b.birthOrder ?? Number.POSITIVE_INFINITY;
    if (av !== bv) return av - bv;
    return a.childId.localeCompare(b.childId);
  });
  for (const e of sortedEdges) {
    const parent = personById.get(e.parentId);
    if (!parent || parent.gender !== "MALE") continue; // 严格父系
    const child = personById.get(e.childId);
    if (!child) continue;
    if (child.isMarriedIn) continue; // 嫁入女子不归属本族世系
    const arr = childrenOf.get(e.parentId) ?? [];
    if (!arr.includes(e.childId)) arr.push(e.childId);
    childrenOf.set(e.parentId, arr);
  }

  // husband → wives
  const spousesOf = new Map<string, string[]>();
  for (const m of [...input.marriages].sort((a, b) => a.order - b.order)) {
    const arr = spousesOf.get(m.husbandId) ?? [];
    if (!arr.includes(m.wifeId)) arr.push(m.wifeId);
    spousesOf.set(m.husbandId, arr);
  }

  // 根：无父记录的男性（女性不作为根；嫁入女子也排除）
  const hasParent = new Set(
    sortedEdges
      .filter((e) => personById.has(e.parentId) && personById.has(e.childId))
      .map((e) => e.childId),
  );
  const rootIds = input.persons
    .filter(
      (p) => p.gender === "MALE" && !p.isMarriedIn && !hasParent.has(p.id),
    )
    .sort((a, b) => {
      if (a.generation !== b.generation) return a.generation - b.generation;
      return (a.birthOrder ?? 0) - (b.birthOrder ?? 0);
    })
    .map((p) => p.id);

  return { personById, childrenOf, spousesOf, rootIds };
}

export function shortPersonAnnotation(p: TreePerson): string {
  const bits: string[] = [];
  if (p.alias) bits.push(`字${p.alias}`);
  if (p.birthYear || p.deathYear) {
    bits.push(`${p.birthYear ?? "?"}—${p.deathYear ?? ""}`);
  }
  return bits.join(" ");
}
