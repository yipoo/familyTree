/**
 * 吊线图（pedigree hanging chart）布局
 *
 * 与 tree-layout 的差异：
 *   - 严格父系：仅男性 + 配偶（妻子展示在男性下方做小字注），不展示外嫁女婿子女
 *   - 顺序：以 birthOrder 升序为兄弟排序基准；缺失则按 createdAt
 *   - 同代严格 Y 对齐
 *   - 父→子之间画"T 字"挂线（不是斜线）
 *
 * 输出适合直接 SVG 渲染：节点 (x, y, w, h) + 直线段集合。
 *
 * 算法 O(n)：
 *   1. 自顶向下 DFS，按子树叶子数计算每个节点占的水平槽位（slot）
 *   2. 第二趟 DFS 把 slot 转成 x 坐标
 */

export interface LineagePerson {
  id: string;
  name: string;
  alias: string | null;
  generation: number;
  generationChar: string | null;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  isMarriedIn: boolean;
  birthOrder: number | null;
  birthYear: number | null;
  deathYear: number | null;
  status: string;
  succession: string | null;
}

export interface LineageEdgeIn {
  parentId: string;
  childId: string;
  birthOrder: number | null;
}

export interface LineageMarriageIn {
  husbandId: string;
  wifeId: string;
  type: string;
  order: number;
}

export interface LineageChartNode {
  id: string;
  person: LineagePerson;
  /** 配偶简要列表（按 order 升序） */
  spouses: LineagePerson[];
  x: number;
  y: number;
  width: number;
  height: number;
  generation: number;
}

export interface LineageChartLine {
  /** "v" = 垂直；"h" = 水平 */
  kind: "v" | "h";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LineageChartLayout {
  nodes: LineageChartNode[];
  lines: LineageChartLine[];
  width: number;
  height: number;
  /** 按从小到大排序的世代号 */
  generations: number[];
  /** 每个世代的 y 位置（Y 中线） */
  yByGen: Record<number, number>;
}

const NODE_W = 78;
const NODE_H = 40;
const COL_GAP = 16;
const ROW_GAP = 56;
const SLOT_W = NODE_W + COL_GAP;
const ROW_H = NODE_H + ROW_GAP;
const MARGIN = 40;

export function layoutLineageChart(input: {
  rootPersonId: string;
  persons: LineagePerson[];
  parentChild: LineageEdgeIn[];
  marriages: LineageMarriageIn[];
}): LineageChartLayout {
  const { rootPersonId, persons, parentChild, marriages } = input;

  const personById = new Map(persons.map((p) => [p.id, p]));

  // 仅保留男性父亲 → 子女的边
  const childrenOf = new Map<string, string[]>();
  for (const pc of parentChild) {
    const parent = personById.get(pc.parentId);
    if (!parent || parent.gender !== "MALE") continue;
    const child = personById.get(pc.childId);
    if (!child) continue;
    // 嫁入女不下钻；这里允许儿子和女儿都展示，但下钻只走儿子
    const arr = childrenOf.get(pc.parentId) ?? [];
    if (!arr.includes(pc.childId)) arr.push(pc.childId);
    childrenOf.set(pc.parentId, arr);
  }

  // 按 birthOrder 排序兄弟（缺失视为 99）
  const orderHint = new Map<string, number>();
  for (const pc of parentChild) {
    if (pc.birthOrder != null) orderHint.set(pc.childId, pc.birthOrder);
  }
  for (const [pid, kids] of childrenOf) {
    kids.sort((a, b) => {
      const oa = orderHint.get(a) ?? personById.get(a)?.birthOrder ?? 99;
      const ob = orderHint.get(b) ?? personById.get(b)?.birthOrder ?? 99;
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b);
    });
    childrenOf.set(pid, kids);
  }

  // 配偶：男 → 妻子列表
  const wivesOf = new Map<string, LineagePerson[]>();
  const sortedMarriages = [...marriages].sort((a, b) => a.order - b.order);
  for (const m of sortedMarriages) {
    const wife = personById.get(m.wifeId);
    if (!wife) continue;
    const arr = wivesOf.get(m.husbandId) ?? [];
    arr.push(wife);
    wivesOf.set(m.husbandId, arr);
  }

  // 收集子树所有男性后代（包括 rootPersonId 自身）
  const reachable = new Set<string>();
  const queue = [rootPersonId];
  while (queue.length) {
    const cur = queue.shift()!;
    if (reachable.has(cur)) continue;
    reachable.add(cur);
    const kids = childrenOf.get(cur) ?? [];
    for (const k of kids) {
      // 只下钻男性后代
      const kp = personById.get(k);
      if (!kp) continue;
      if (kp.gender === "MALE") queue.push(k);
    }
  }

  // 第一趟：计算每个节点叶子槽位数
  const slotCount = new Map<string, number>();
  function calcSlots(id: string): number {
    if (slotCount.has(id)) return slotCount.get(id)!;
    const kids = (childrenOf.get(id) ?? []).filter(
      (c) => personById.get(c)?.gender === "MALE",
    );
    let s = 0;
    if (kids.length === 0) s = 1;
    else for (const k of kids) s += calcSlots(k);
    slotCount.set(id, s);
    return s;
  }
  calcSlots(rootPersonId);

  // 第二趟：分配 x（slot 起点 → 中心）
  const xOf = new Map<string, number>();
  function placeX(id: string, slotStart: number) {
    const slots = slotCount.get(id) ?? 1;
    const cx = MARGIN + (slotStart + slots / 2) * SLOT_W - SLOT_W / 2;
    xOf.set(id, cx - NODE_W / 2);
    let cursor = slotStart;
    const kids = (childrenOf.get(id) ?? []).filter(
      (c) => personById.get(c)?.gender === "MALE",
    );
    for (const k of kids) {
      placeX(k, cursor);
      cursor += slotCount.get(k) ?? 1;
    }
  }
  placeX(rootPersonId, 0);

  // 计算 y 与 generations
  const root = personById.get(rootPersonId);
  if (!root) {
    return {
      nodes: [],
      lines: [],
      width: 0,
      height: 0,
      generations: [],
      yByGen: {},
    };
  }
  const gens = new Set<number>();
  for (const id of reachable) {
    const p = personById.get(id);
    if (p) gens.add(p.generation);
  }
  const generations = Array.from(gens).sort((a, b) => a - b);
  const yByGen: Record<number, number> = {};
  generations.forEach((g, i) => {
    yByGen[g] = MARGIN + i * ROW_H;
  });

  // 输出 nodes
  const nodes: LineageChartNode[] = [];
  for (const id of reachable) {
    const p = personById.get(id);
    if (!p) continue;
    nodes.push({
      id,
      person: p,
      spouses: wivesOf.get(id) ?? [],
      x: xOf.get(id) ?? MARGIN,
      y: yByGen[p.generation],
      width: NODE_W,
      height: NODE_H,
      generation: p.generation,
    });
  }

  // 计算 lines（父→子的"T 字"挂线）
  const lines: LineageChartLine[] = [];
  for (const id of reachable) {
    const kids = (childrenOf.get(id) ?? []).filter(
      (k) => reachable.has(k) && personById.get(k)?.gender === "MALE",
    );
    if (kids.length === 0) continue;
    const px = (xOf.get(id) ?? 0) + NODE_W / 2;
    const py = yByGen[personById.get(id)!.generation] + NODE_H;
    const childYTop = yByGen[personById.get(id)!.generation + 1];
    const midY = (py + childYTop) / 2;
    // 父向下到中线
    lines.push({ kind: "v", x1: px, y1: py, x2: px, y2: midY });
    if (kids.length === 1) {
      const k = kids[0];
      const cx = (xOf.get(k) ?? 0) + NODE_W / 2;
      lines.push({ kind: "v", x1: cx, y1: midY, x2: cx, y2: childYTop });
      if (cx !== px) {
        lines.push({ kind: "h", x1: px, y1: midY, x2: cx, y2: midY });
      }
    } else {
      const xs = kids.map((k) => (xOf.get(k) ?? 0) + NODE_W / 2);
      const minX = Math.min(...xs, px);
      const maxX = Math.max(...xs, px);
      lines.push({ kind: "h", x1: minX, y1: midY, x2: maxX, y2: midY });
      for (const cx of xs) {
        lines.push({ kind: "v", x1: cx, y1: midY, x2: cx, y2: childYTop });
      }
    }
  }

  const totalSlots = slotCount.get(rootPersonId) ?? 1;
  const width = totalSlots * SLOT_W + MARGIN;
  const height = generations.length * ROW_H + MARGIN;

  return { nodes, lines, width, height, generations, yByGen };
}
