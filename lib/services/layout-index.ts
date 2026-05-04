/**
 * 给定 layout（节点 + 边），构建 O(1) 查询所需的索引：
 *   - nodesById:        id → LayoutNode
 *   - parentsOf / spousesOf / childrenOf:  personId → LayoutNode[]
 *   - fatherOf:         id → fatherId（仅父系 male 边）
 *   - childrenByFather: fatherId → childId[]
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
    }
  }

  return {
    nodesById,
    parentsOf,
    spousesOf,
    childrenOf,
    fatherOf,
    childrenByFather,
  };
}
