/**
 * 五服「树图」布局
 *
 * 把 computeWufu 算出的五服成员集合排成一棵世系树：
 *   - 节点 = 本宗血亲（含本族女儿），配偶挂在其夫名下做小字；
 *   - 以五服内最高的祖先（一般是高祖）为根，父→子用"T 字"挂线相连；
 *   - 女儿无本宗后代，作叶子节点；
 *   - 每个节点带「与己的称谓」，己高亮。
 *
 * 仅依赖 WufuChart 结果 + parentChild 边，纯函数，输出可直接 SVG 渲染。
 */
import type { WufuChart, WufuMember } from "./wufu";

export interface WufuTreeNode {
  id: string; // personId
  term: string; // 与己的称谓
  name: string;
  isSelf: boolean;
  col: number; // 0=直系本支
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  spouses: { term: string; name: string }[];
  x: number;
  y: number;
  width: number;
  height: number;
  genOffset: number;
}

export interface WufuTreeLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface WufuTreeRow {
  genOffset: number;
  label: string;
  y: number;
}

export interface WufuTreeLayout {
  nodes: WufuTreeNode[];
  lines: WufuTreeLine[];
  rows: WufuTreeRow[];
  width: number;
  height: number;
  selfId: string | null;
}

const NODE_W = 80;
const NODE_H = 48;
const COL_GAP = 14;
const ROW_GAP = 60;
const SLOT_W = NODE_W + COL_GAP;
const ROW_H = NODE_H + ROW_GAP;
const MARGIN = 24;

export function layoutWufuTree(input: {
  chart: WufuChart;
  parentChild: { parentId: string; childId: string }[];
  /** personId → birthOrder（用于兄弟排序），缺失视为末位 */
  birthOrderById?: Map<string, number | null>;
}): WufuTreeLayout {
  const { chart, parentChild, birthOrderById } = input;
  const members = chart.generations.flatMap((g) => g.members);

  // 血亲节点（排除配偶）
  const blood = members.filter(
    (m): m is WufuMember & { personId: string } =>
      !m.isSpouse && !!m.personId,
  );
  const bloodIds = new Set(blood.map((m) => m.personId));
  const memberById = new Map(blood.map((m) => [m.personId, m]));

  // 配偶按夫归并
  const spousesByHusband = new Map<string, WufuMember[]>();
  for (const m of members) {
    if (!m.isSpouse || !m.spouseOf) continue;
    (
      spousesByHusband.get(m.spouseOf) ??
      spousesByHusband.set(m.spouseOf, []).get(m.spouseOf)!
    ).push(m);
  }

  // 仅保留集合内的父→子边
  const childrenOf = new Map<string, string[]>();
  const hasParentInSet = new Set<string>();
  for (const pc of parentChild) {
    if (!bloodIds.has(pc.parentId) || !bloodIds.has(pc.childId)) continue;
    (
      childrenOf.get(pc.parentId) ??
      childrenOf.set(pc.parentId, []).get(pc.parentId)!
    ).push(pc.childId);
    hasParentInSet.add(pc.childId);
  }
  // 兄弟排序：birthOrder 升序，缺失末位
  const ord = (id: string) => birthOrderById?.get(id) ?? 99;
  for (const [pid, kids] of childrenOf) {
    kids.sort((a, b) => ord(a) - ord(b) || a.localeCompare(b));
    childrenOf.set(pid, kids);
  }

  // 根：集合内没有父的血亲（一般唯一＝高祖），按辈分从高到低
  const roots = blood
    .filter((m) => !hasParentInSet.has(m.personId))
    .map((m) => m.personId)
    .sort(
      (a, b) =>
        memberById.get(a)!.genOffset - memberById.get(b)!.genOffset ||
        ord(a) - ord(b),
    );

  // 世代 → 行 y
  const gens = [...new Set(blood.map((m) => m.genOffset))].sort((a, b) => a - b);
  const yByGen = new Map<number, number>();
  gens.forEach((g, i) => yByGen.set(g, MARGIN + i * ROW_H));
  const labelByGen = new Map(
    chart.generations.map((g) => [g.genOffset, g.label]),
  );

  // 第一趟：叶子槽位
  const slot = new Map<string, number>();
  function calc(id: string): number {
    const cached = slot.get(id);
    if (cached != null) return cached;
    const kids = childrenOf.get(id) ?? [];
    const s = kids.length ? kids.reduce((a, k) => a + calc(k), 0) : 1;
    slot.set(id, s);
    return s;
  }
  // 第二趟：分配 x
  const xOf = new Map<string, number>();
  function place(id: string, start: number) {
    const s = slot.get(id) ?? 1;
    const cx = MARGIN + (start + s / 2) * SLOT_W - SLOT_W / 2;
    xOf.set(id, cx - NODE_W / 2);
    let cur = start;
    for (const k of childrenOf.get(id) ?? []) {
      place(k, cur);
      cur += slot.get(k) ?? 1;
    }
  }
  let cursor = 0;
  for (const r of roots) {
    calc(r);
    place(r, cursor);
    cursor += slot.get(r) ?? 1;
  }
  const totalSlots = Math.max(cursor, 1);

  // 节点
  const nodes: WufuTreeNode[] = blood.map((m) => ({
    id: m.personId,
    term: m.term,
    name: m.name,
    isSelf: m.isSelf,
    col: m.col,
    gender: m.gender,
    spouses: (spousesByHusband.get(m.personId) ?? []).map((s) => ({
      term: s.term,
      name: s.name,
    })),
    x: xOf.get(m.personId) ?? MARGIN,
    y: yByGen.get(m.genOffset) ?? MARGIN,
    width: NODE_W,
    height: NODE_H,
    genOffset: m.genOffset,
  }));

  // 连线（父→子 T 字）
  const lines: WufuTreeLine[] = [];
  for (const [pid, kids] of childrenOf) {
    if (!kids.length) continue;
    const px = (xOf.get(pid) ?? 0) + NODE_W / 2;
    const pg = memberById.get(pid)!.genOffset;
    const py = (yByGen.get(pg) ?? 0) + NODE_H;
    const childGen = memberById.get(kids[0])!.genOffset;
    const childYTop = yByGen.get(childGen) ?? py + ROW_GAP;
    const midY = (py + childYTop) / 2;
    lines.push({ x1: px, y1: py, x2: px, y2: midY });
    const xs = kids.map((k) => (xOf.get(k) ?? 0) + NODE_W / 2);
    if (kids.length === 1) {
      const cx = xs[0];
      if (cx !== px) lines.push({ x1: px, y1: midY, x2: cx, y2: midY });
      lines.push({ x1: cx, y1: midY, x2: cx, y2: childYTop });
    } else {
      const minX = Math.min(...xs, px);
      const maxX = Math.max(...xs, px);
      lines.push({ x1: minX, y1: midY, x2: maxX, y2: midY });
      for (const cx of xs) {
        lines.push({ x1: cx, y1: midY, x2: cx, y2: childYTop });
      }
    }
  }

  const rows: WufuTreeRow[] = gens.map((g) => ({
    genOffset: g,
    label: labelByGen.get(g) ?? `${g}辈`,
    y: yByGen.get(g) ?? 0,
  }));

  return {
    nodes,
    lines,
    rows,
    width: totalSlots * SLOT_W + MARGIN,
    height: gens.length * ROW_H + MARGIN,
    selfId: blood.find((m) => m.isSelf)?.personId ?? null,
  };
}
