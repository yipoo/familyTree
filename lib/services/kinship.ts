/**
 * 亲属关系工具：近亲 5 代过滤（kin5）。
 *
 * 「近亲 5 代」= 以某人 root 为中心、上下各 ±2 代直系，加上配偶 + 兄弟姐妹及其
 * 配偶 / 子女。具体收敛：
 *
 *   - 上行 2 代：父母、祖父母（含双方）
 *   - 下行 2 代：子女、孙子女
 *   - 旁系：自己的兄弟姐妹（同父母）+ 他们的配偶 + 子女
 *   - 配偶：root / 父母 / 祖父母 / 子女 / 孙子女 / 兄弟姐妹 各自的配偶
 *
 * 这覆盖了「直系 5 代」+ 一层旁系 + 各级配偶——既能看清根人物的核心关系网，
 * 又不会拖出整族（例如旁系堂兄弟、姑舅、再下一代等不会出现）。
 *
 * 输入：`persons` / `parentChild` / `marriages` 同 graph route 用的精简结构
 * 输出：满足条件的 personId 集合 + 受允许的 ParentChild 边 key 集合
 */

export interface KinPerson {
  id: string;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
}

export interface KinParentChild {
  parentId: string;
  childId: string;
}

export interface KinMarriage {
  husbandId: string;
  wifeId: string;
}

export interface Kin5Result {
  /** 集合内人物 id */
  ids: Set<string>;
  /** 允许的父子边 key（`parentId::childId`）—— 用于布局算法收边 */
  edges: Set<string>;
  /** 显式的根 */
  rootPersonId: string;
}

const edgeKey = (pid: string, cid: string) => `${pid}::${cid}`;

export function computeKin5(input: {
  rootPersonId: string;
  persons: KinPerson[];
  parentChild: KinParentChild[];
  marriages: KinMarriage[];
}): Kin5Result {
  const personById = new Map(input.persons.map((p) => [p.id, p]));
  if (!personById.has(input.rootPersonId)) {
    return { ids: new Set(), edges: new Set(), rootPersonId: input.rootPersonId };
  }

  // 父母 / 子女索引
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const pc of input.parentChild) {
    if (!personById.has(pc.parentId) || !personById.has(pc.childId)) continue;
    const ps = parentsOf.get(pc.childId) ?? [];
    if (!ps.includes(pc.parentId)) ps.push(pc.parentId);
    parentsOf.set(pc.childId, ps);
    const cs = childrenOf.get(pc.parentId) ?? [];
    if (!cs.includes(pc.childId)) cs.push(pc.childId);
    childrenOf.set(pc.parentId, cs);
  }
  // 配偶
  const spousesOf = new Map<string, string[]>();
  for (const m of input.marriages) {
    if (!personById.has(m.husbandId) || !personById.has(m.wifeId)) continue;
    const a = spousesOf.get(m.husbandId) ?? [];
    if (!a.includes(m.wifeId)) a.push(m.wifeId);
    spousesOf.set(m.husbandId, a);
    const b = spousesOf.get(m.wifeId) ?? [];
    if (!b.includes(m.husbandId)) b.push(m.husbandId);
    spousesOf.set(m.wifeId, b);
  }

  const ids = new Set<string>();
  const edges = new Set<string>();
  const root = input.rootPersonId;
  ids.add(root);

  // 上行 2 代：父母 + 祖父母
  const parentsLevel1 = parentsOf.get(root) ?? [];
  for (const p of parentsLevel1) {
    ids.add(p);
    edges.add(edgeKey(p, root));
  }
  for (const p1 of parentsLevel1) {
    const grand = parentsOf.get(p1) ?? [];
    for (const g of grand) {
      ids.add(g);
      edges.add(edgeKey(g, p1));
    }
  }

  // 下行 2 代：子女 + 孙子女
  const childrenLevel1 = childrenOf.get(root) ?? [];
  for (const c of childrenLevel1) {
    ids.add(c);
    edges.add(edgeKey(root, c));
  }
  for (const c1 of childrenLevel1) {
    const gks = childrenOf.get(c1) ?? [];
    for (const g of gks) {
      ids.add(g);
      edges.add(edgeKey(c1, g));
    }
  }

  // 兄弟姐妹（同父母）：取 root 的所有父母，列出他们的所有子女，再排除 root 自己
  const siblingSet = new Set<string>();
  for (const p of parentsLevel1) {
    for (const sib of childrenOf.get(p) ?? []) {
      if (sib !== root) siblingSet.add(sib);
    }
  }
  for (const sib of siblingSet) {
    ids.add(sib);
    // 兄弟姐妹与父母的边
    for (const p of parentsOf.get(sib) ?? []) {
      if (ids.has(p)) edges.add(edgeKey(p, sib));
    }
    // 兄弟姐妹的子女（侄甥）
    for (const nibling of childrenOf.get(sib) ?? []) {
      ids.add(nibling);
      edges.add(edgeKey(sib, nibling));
    }
  }

  // 配偶：上面一切人物的配偶都纳入
  const seedForSpouses = [...ids];
  for (const id of seedForSpouses) {
    for (const sp of spousesOf.get(id) ?? []) {
      ids.add(sp);
    }
  }

  return { ids, edges, rootPersonId: root };
}
