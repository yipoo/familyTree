/**
 * 迁徙图数据（纯函数，可单测）：
 *   - layoutMigrationFlow：把"地点节点 + 迁徙边"做拓扑分层布局（左→右按迁徙先后，
 *     同层纵向堆叠、整列垂直居中），供 SVG 渲染迁徙脉络。
 *   - resolveResidenceCounts：全员居住地解析（缺省沿父系继承、嫁入女子随夫），
 *     聚合出各地点人数——"聚居分布"是迁徙的结果状态。
 *   - shortLocationName：地点短名（村/镇/县优先，长 fullText 取「·」后段）。
 */

export interface FlowNodeIn {
  id: string;
  name: string;
  count?: number;
}

export interface FlowEdgeIn {
  fromId: string;
  toId: string;
  /** 边注（如"明初调宿"） */
  label: string;
  /** 迁徙主体（如"始祖太公"、"二门（坤公支）"） */
  subject: string;
}

export interface FlowNode {
  id: string;
  name: string;
  count: number;
  col: number;
  row: number;
  x: number;
  y: number;
}

export interface FlowEdge {
  from: FlowNode;
  to: FlowNode;
  label: string;
  subject: string;
}

export interface FlowLayout {
  nodes: FlowNode[];
  edges: FlowEdge[];
  width: number;
  height: number;
}

export const FLOW_NODE_W = 172;
export const FLOW_NODE_H = 56;
const GAP_X = 132;
const GAP_Y = 30;

export function layoutMigrationFlow(
  nodesIn: FlowNodeIn[],
  edgesIn: FlowEdgeIn[],
): FlowLayout {
  // 只布局参与迁徙的地点；孤立地点属"聚居分布"板块，不进脉络图
  const used = new Set<string>();
  for (const e of edgesIn) {
    used.add(e.fromId);
    used.add(e.toId);
  }
  const nodes0 = nodesIn.filter((n) => used.has(n.id));

  // 拓扑分层：col = 最长入链深度；最多迭代 V 轮，环数据也能终止
  const col = new Map<string, number>(nodes0.map((n) => [n.id, 0]));
  for (let i = 0; i < nodes0.length; i++) {
    let changed = false;
    for (const e of edgesIn) {
      const fc = col.get(e.fromId);
      const tc = col.get(e.toId);
      if (fc === undefined || tc === undefined) continue;
      if (tc < fc + 1) {
        col.set(e.toId, fc + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // 同列按输入顺序堆叠成行
  const byCol = new Map<number, FlowNodeIn[]>();
  for (const n of nodes0) {
    const c = col.get(n.id) ?? 0;
    const arr = byCol.get(c) ?? [];
    arr.push(n);
    byCol.set(c, arr);
  }
  const maxRows = Math.max(0, ...Array.from(byCol.values()).map((a) => a.length));
  const totalH = Math.max(FLOW_NODE_H, maxRows * FLOW_NODE_H + (maxRows - 1) * GAP_Y);

  const nodes: FlowNode[] = [];
  const byId = new Map<string, FlowNode>();
  for (const [c, arr] of byCol) {
    const colH = arr.length * FLOW_NODE_H + (arr.length - 1) * GAP_Y;
    const off = (totalH - colH) / 2;
    arr.forEach((n, r) => {
      const node: FlowNode = {
        id: n.id,
        name: n.name,
        count: n.count ?? 0,
        col: c,
        row: r,
        x: c * (FLOW_NODE_W + GAP_X),
        y: off + r * (FLOW_NODE_H + GAP_Y),
      };
      nodes.push(node);
      byId.set(n.id, node);
    });
  }

  const edges: FlowEdge[] = [];
  for (const e of edgesIn) {
    const from = byId.get(e.fromId);
    const to = byId.get(e.toId);
    if (from && to) edges.push({ from, to, label: e.label, subject: e.subject });
  }

  const maxCol = Math.max(0, ...Array.from(byCol.keys()));
  return {
    nodes,
    edges,
    width: maxCol * (FLOW_NODE_W + GAP_X) + FLOW_NODE_W,
    height: totalH,
  };
}

export interface ResidencePersonIn {
  id: string;
  residenceId: string | null;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  isMarriedIn: boolean;
}

/**
 * 全员居住地解析 → Map<locationId, 人数>。
 * 规则与册谱一致：本人未填则沿父系继承；嫁入女子随夫。memo + 环防护。
 */
export function resolveResidenceCounts(
  persons: ResidencePersonIn[],
  parentChild: { parentId: string; childId: string }[],
  marriages: { husbandId: string; wifeId: string }[],
): Map<string, number> {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const fatherOf = new Map<string, string>();
  for (const pc of parentChild) {
    const parent = byId.get(pc.parentId);
    if (parent && parent.gender === "MALE" && !fatherOf.has(pc.childId)) {
      fatherOf.set(pc.childId, pc.parentId);
    }
  }
  const husbandOf = new Map<string, string>();
  for (const m of marriages) {
    if (!husbandOf.has(m.wifeId)) husbandOf.set(m.wifeId, m.husbandId);
  }

  const memo = new Map<string, string | null>();
  const resolve = (id: string): string | null => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    memo.set(id, null); // 环防护：先占位
    const p = byId.get(id);
    if (!p) return null;
    let r: string | null = p.residenceId;
    if (!r) {
      const up = p.isMarriedIn ? husbandOf.get(id) : fatherOf.get(id);
      r = up ? resolve(up) : null;
    }
    memo.set(id, r);
    return r;
  };

  const counts = new Map<string, number>();
  for (const p of persons) {
    const r = resolve(p.id);
    if (r) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return counts;
}

/** 地点短名：村 > 镇 > 县 > 市 > fullText 的「·」后段 > fullText。 */
export function shortLocationName(loc: {
  fullText: string;
  village?: string | null;
  town?: string | null;
  county?: string | null;
  city?: string | null;
}): string {
  if (loc.village) return loc.village;
  if (loc.town) return loc.town;
  if (loc.county) return loc.county;
  if (loc.city) return loc.city;
  const seg = loc.fullText.split("·").pop()?.trim();
  return seg || loc.fullText;
}
