/**
 * 给定 layout（节点 + 边），构建 O(1) 查询所需的索引：
 *   - nodesById:           id → LayoutNode
 *   - parentsOf / spousesOf / childrenOf:  personId → LayoutNode[]
 *   - fatherOf:            id → fatherId（仅父系 male 边）
 *   - childrenByFather:    fatherId → childId[]
 *   - visibleChildrenOf:   id → childId[]（仅"非 hidden 的父子边"，与 TreeCanvas 折叠语义一致）
 *   - marriedInSpousesOf:  id → spouseId[]（嫁入该家族的配偶；折叠时一并隐藏）
 *   - descendantCountOf:   id → 折叠该节点时实际隐藏的人数（含血缘后代 + 他们的嫁入配偶）
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
  /** 节点 id → 嫁入该家族的配偶 id[]（仅 isMarriedIn=true 的配偶） */
  marriedInSpousesOf: Map<string, string[]>;
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
  // marriedInSpousesOf：在 spousesOf 基础上仅留嫁入的（折叠时跟随血缘节点一起隐藏）
  const marriedInSpousesOf = new Map<string, string[]>();

  for (const e of layout.edges) {
    if (e.kind === "marriage") {
      const a = nodesById.get(e.source);
      const b = nodesById.get(e.target);
      if (a && b) {
        push(spousesOf, a.id, b);
        push(spousesOf, b.id, a);
        // 嫁入配偶：从对方角度记录"我有这个嫁入配偶"
        // tree-layout 当前用 husband=男 / wife=女（含入赘 isMarriedIn），所以两端都要查
        if (a.person.isMarriedIn && !b.person.isMarriedIn) {
          const arr = marriedInSpousesOf.get(b.id) ?? [];
          if (!arr.includes(a.id)) arr.push(a.id);
          marriedInSpousesOf.set(b.id, arr);
        }
        if (b.person.isMarriedIn && !a.person.isMarriedIn) {
          const arr = marriedInSpousesOf.get(a.id) ?? [];
          if (!arr.includes(b.id)) arr.push(b.id);
          marriedInSpousesOf.set(a.id, arr);
        }
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

  // descendantCountOf：与 TreeCanvas 折叠隐藏逻辑等价——
  // 折叠节点 X 时，X 的所有血缘后代以及他们的嫁入配偶都会被隐藏。
  // 这里 BFS 走 visibleChildrenOf；对每个被收集到的后代，再加上他的 marriedInSpousesOf。
  // 嫁入配偶不再下钻（嫁入方在该家族无视为血缘后代的子女）。
  const descendantCountOf = new Map<string, number>();
  for (const id of nodesById.keys()) {
    const hidden = new Set<string>();
    const queue = [...(visibleChildrenOf.get(id) ?? [])];
    while (queue.length) {
      const cur = queue.shift()!;
      if (hidden.has(cur)) continue;
      hidden.add(cur);
      // 嫁入配偶（仅记一次；不再继续下钻）
      for (const sp of marriedInSpousesOf.get(cur) ?? []) {
        if (!hidden.has(sp)) hidden.add(sp);
      }
      // 继续下钻 cur 的血缘后代
      for (const n of visibleChildrenOf.get(cur) ?? []) queue.push(n);
    }
    descendantCountOf.set(id, hidden.size);
  }

  return {
    nodesById,
    parentsOf,
    spousesOf,
    childrenOf,
    fatherOf,
    childrenByFather,
    visibleChildrenOf,
    marriedInSpousesOf,
    descendantCountOf,
  };
}
