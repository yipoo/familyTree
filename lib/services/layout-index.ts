/**
 * 给定 layout（节点 + 边），构建 O(1) 查询所需的索引：
 *   - nodesById:           id → LayoutNode
 *   - parentsOf / spousesOf / childrenOf:  personId → LayoutNode[]
 *   - fatherOf:            id → fatherId（仅父系 male 边）
 *   - childrenByFather:    fatherId → childId[]
 *   - visibleChildrenOf:   id → childId[]（仅"非 hidden 的父子边"，与 TreeCanvas 折叠语义一致）
 *   - descendantCountOf:   id → 该节点在 visibleChildrenOf 下的全部后代数（递归求和）
 *
 * 仅在 layout 变化时构建一次，后续每次点击节点 inspector 直接查表。
 */
import type { LayoutNode, LayoutEdge } from "@/lib/services/tree-layout";

export interface LayoutIndex {
  nodesById: Map<string, LayoutNode>;
  parentsOf: Map<string, LayoutNode[]>;
  spousesOf: Map<string, LayoutNode[]>;
  childrenOf: Map<string, LayoutNode[]>;
  fatherOf: Map<string, string>;
  childrenByFather: Map<string, string[]>;
  visibleChildrenOf: Map<string, string[]>;
  descendantCountOf: Map<string, number>;
}

export function buildLayoutIndex(layout: {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}): LayoutIndex {
  const nodesById = new Map<string, LayoutNode>();
  for (const n of layout.nodes) nodesById.set(n.id, n);

  const parentsOf = new Map<string, LayoutNode[]>();
  const spousesOf = new Map<string, LayoutNode[]>();
  const childrenOf = new Map<string, LayoutNode[]>();
  const fatherOf = new Map<string, string>();
  const childrenByFather = new Map<string, string[]>();

  function push<V>(map: Map<string, V[]>, key: string, val: V) {
    const arr = map.get(key);
    if (arr) arr.push(val);
    else map.set(key, [val]);
  }

  // visibleChildrenOf：与 TreeCanvas 折叠语义一致——仅"非 hidden 的 parent-child 边"
  // （hidden 边代表母→子等关系数据，不参与渲染连线，也不算入折叠后代）
  const visibleChildrenOf = new Map<string, string[]>();

  for (const e of layout.edges) {
    if (e.kind === "marriage") {
      const a = nodesById.get(e.source);
      const b = nodesById.get(e.target);
      if (a && b) {
        push(spousesOf, a.id, b);
        push(spousesOf, b.id, a);
      }
    } else if (e.kind === "parent-child") {
      const parent = nodesById.get(e.source);
      const child = nodesById.get(e.target);
      if (!parent || !child) continue;
      push(parentsOf, child.id, parent);
      // 子女按"该父亲"去重；多 parent 边时只取一次
      const exists = (childrenOf.get(parent.id) ?? []).some(
        (c) => c.id === child.id,
      );
      if (!exists) push(childrenOf, parent.id, child);
      if (parent.person.gender === "MALE") {
        if (!fatherOf.has(child.id)) fatherOf.set(child.id, parent.id);
        const arr = childrenByFather.get(parent.id) ?? [];
        if (!arr.includes(child.id)) arr.push(child.id);
        childrenByFather.set(parent.id, arr);
      }
      if (!e.hidden) {
        const arr = visibleChildrenOf.get(parent.id) ?? [];
        if (!arr.includes(child.id)) arr.push(child.id);
        visibleChildrenOf.set(parent.id, arr);
      }
    }
  }

  // descendantCountOf：基于 visibleChildrenOf BFS。memoize 避免对同一节点重复展开。
  const descendantCountOf = new Map<string, number>();
  function countDescendants(id: string): number {
    const cached = descendantCountOf.get(id);
    if (cached !== undefined) return cached;
    let total = 0;
    const queue = [...(visibleChildrenOf.get(id) ?? [])];
    const seen = new Set<string>();
    while (queue.length) {
      const cur = queue.shift()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      total++;
      const next = visibleChildrenOf.get(cur) ?? [];
      for (const n of next) queue.push(n);
    }
    descendantCountOf.set(id, total);
    return total;
  }
  for (const id of nodesById.keys()) countDescendants(id);

  return {
    nodesById,
    parentsOf,
    spousesOf,
    childrenOf,
    fatherOf,
    childrenByFather,
    visibleChildrenOf,
    descendantCountOf,
  };
}
