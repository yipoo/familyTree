/**
 * 父系家谱布局算法（v2）
 *
 * 输入：一族内所有 Person + Marriage + ParentChild
 * 输出：每个人物节点的 (x, y) 坐标 + 连线（婚配 + 亲子）
 *
 * 设计要点（参考 docs/1.jpg）：
 *  - 妻子居左、丈夫居右，夫妻间距极小（SPOUSE_GAP），让"父母连线"尽量短
 *  - 子女在"丈夫"正下方居中分布，使父子连线尽可能直（不绕弯）
 *  - 父→子有连线；母（嫁入妻）与子女之间不画线
 *  - 同世代 Y 对齐
 */

export interface PersonInput {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  generation: number;
  generationChar: string | null;
  isMarriedIn: boolean;
  status: string;
  /** 选填：popup 信息展示用 */
  alias?: string | null;
  birthOrder?: number | null;
}

export interface MarriageInput {
  id: string;
  husbandId: string;
  wifeId: string;
  type: string;
  order: number;
}

export interface ParentChildInput {
  parentId: string;
  childId: string;
  birthOrder: number | null;
}

export interface LayoutNode {
  id: string;
  person: PersonInput;
  x: number;
  y: number;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  kind: "marriage" | "parent-child";
  /** true 表示仅作为关系数据存在（如母→子），不参与连线渲染 */
  hidden?: boolean;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  generations: number[];
}

// 节点为竖向长方形：窄而高，姓名竖排
const NODE_W = 48;
const NODE_H = 132;
const SPOUSE_GAP = 4; // 夫妻之间留白：尽量短
const H_GAP = 22; // 同代不同家庭单元 / 兄弟姐妹 / 同代节点间距
const V_GAP = 56; // 父子代之间的额外间距

/** 节点间距档位（"紧凑｜适中｜宽松"）。仅缩放间距，不改变节点本身尺寸。 */
export type SpacingPreset = "compact" | "normal" | "loose";

export const SPACING_PRESETS: Record<
  SpacingPreset,
  { x: number; y: number }
> = {
  compact: { x: 0.7, y: 0.85 },
  normal: { x: 1, y: 1 },
  loose: { x: 1.5, y: 1.2 },
};

export const DEFAULT_SPACING: SpacingPreset = "normal";

export function isSpacingPreset(v: unknown): v is SpacingPreset {
  return v === "compact" || v === "normal" || v === "loose";
}

interface FamilyUnit {
  husband: PersonInput;
  wives: PersonInput[];
  childrenIds: string[];
}

export function layoutPaternalTree(opts: {
  rootPersonId: string;
  persons: PersonInput[];
  marriages: MarriageInput[];
  parentChild: ParentChildInput[];
  /** 间距档位（默认 "normal"）。控制 H_GAP / V_GAP / SPOUSE_GAP 的缩放因子。 */
  spacing?: SpacingPreset;
}): LayoutResult {
  const preset = opts.spacing ?? DEFAULT_SPACING;
  const { x: xScale, y: yScale } = SPACING_PRESETS[preset];
  // 仅缩放间距，节点尺寸保持不变——这样紧凑档不会让节点重叠
  const H_GAP_S = H_GAP * xScale;
  const SPOUSE_GAP_S = SPOUSE_GAP * xScale;
  const V_GAP_S = V_GAP * yScale;
  const ROW_H_S = NODE_H + V_GAP_S;
  const personById = new Map(opts.persons.map((p) => [p.id, p]));

  // husbandId -> wives 按婚序倒序：order 大的（继配）在前，order 小的（原配）在后；
  // 占位时左→右，故 原配 落在最右、紧贴丈夫，继配 越往左越早
  const wivesByHusband = new Map<string, PersonInput[]>();
  for (const m of [...opts.marriages].sort((a, b) => b.order - a.order)) {
    const wife = personById.get(m.wifeId);
    if (!wife) continue;
    const arr = wivesByHusband.get(m.husbandId) ?? [];
    arr.push(wife);
    wivesByHusband.set(m.husbandId, arr);
  }

  // fatherId -> children 按排行倒序：birthOrder 大的（年幼）在前，1 号（长子/老大）在后；
  // 占位时左→右，故 老大 落在最右
  const childrenByFather = new Map<string, string[]>();
  for (const pc of [...opts.parentChild].sort(
    (a, b) => (b.birthOrder ?? 0) - (a.birthOrder ?? 0),
  )) {
    const parent = personById.get(pc.parentId);
    if (!parent || parent.gender !== "MALE") continue;
    const arr = childrenByFather.get(pc.parentId) ?? [];
    if (!arr.includes(pc.childId)) arr.push(pc.childId);
    childrenByFather.set(pc.parentId, arr);
  }

  function unitOf(husbandId: string): FamilyUnit {
    const husband = personById.get(husbandId)!;
    const wives = wivesByHusband.get(husbandId) ?? [];
    return {
      husband,
      wives,
      childrenIds: childrenByFather.get(husbandId) ?? [],
    };
  }

  /**
   * 子树几何：以 husband.center 为水平锚点
   *   - leftExt:  锚点左侧延伸距离（非负）
   *   - rightExt: 锚点右侧延伸距离（非负）
   * width = leftExt + rightExt
   *
   * place(centerX) 根据"目标 husband.center 的绝对 X"放置整棵子树。
   */
  interface Sub {
    leftExt: number;
    rightExt: number;
    place: (centerX: number) => void;
  }

  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];

  function build(personId: string): Sub {
    const person = personById.get(personId);
    if (!person) return { leftExt: 0, rightExt: 0, place: () => {} };

    const unit = unitOf(personId);

    // unit 内：以 "夫妻中点（unit 几何中心）" 作为子树水平锚点。
    // 这使父子连线从夫妻中点正下方落下，符合传统家谱排版（参考 1.jpg）。
    const unitWidth =
      NODE_W * (1 + unit.wives.length) + SPOUSE_GAP_S * unit.wives.length;
    const unitLeft = unitWidth / 2;
    const unitRight = unitWidth / 2;

    // 子女子树
    const childSubs = unit.childrenIds.map((cid) => build(cid));

    // 子女总宽度：相邻子树间留 H_GAP，children row 整体居中于 husband.center
    let childrenRowWidth = 0;
    for (let i = 0; i < childSubs.length; i++) {
      childrenRowWidth += childSubs[i].leftExt + childSubs[i].rightExt;
      if (i > 0) childrenRowWidth += H_GAP_S;
    }

    const childRowLeft = childrenRowWidth / 2;
    const childRowRight = childrenRowWidth / 2;

    const leftExt = Math.max(unitLeft, childRowLeft);
    const rightExt = Math.max(unitRight, childRowRight);

    return {
      leftExt,
      rightExt,
      place: (centerX: number) => {
        const y = (person.generation - rootGen) * ROW_H_S;

        // unit 左边缘（centerX 即 unit 中心）
        const unitLeftEdge = centerX - unitWidth / 2;

        // 妻子在左侧依次排开（按 order 升序）
        let cursor = unitLeftEdge;
        for (const w of unit.wives) {
          nodes.push({ id: w.id, person: w, x: cursor, y });
          cursor += NODE_W + SPOUSE_GAP_S;
        }

        // 丈夫位于妻子右侧
        const husbandX = cursor;
        nodes.push({ id: person.id, person, x: husbandX, y });

        // 婚配连线：每位妻子 right → 丈夫 left
        for (const w of unit.wives) {
          edges.push({
            id: `m-${w.id}-${person.id}`,
            source: w.id,
            target: person.id,
            kind: "marriage",
          });
        }

        // 子女：children row 整体居中于 centerX
        let childCursor = centerX - childrenRowWidth / 2;
        for (let i = 0; i < unit.childrenIds.length; i++) {
          const childId = unit.childrenIds[i];
          const sub = childSubs[i];
          const childCenter = childCursor + sub.leftExt;
          sub.place(childCenter);
          // 父→子（可见）
          edges.push({
            id: `pc-${person.id}-${childId}`,
            source: person.id,
            target: childId,
            kind: "parent-child",
          });
          // 母→子（仅数据，不渲染；popup 用于显示双亲）
          for (const w of unit.wives) {
            edges.push({
              id: `pc-w-${w.id}-${childId}`,
              source: w.id,
              target: childId,
              kind: "parent-child",
              hidden: true,
            });
          }
          childCursor += sub.leftExt + sub.rightExt + H_GAP_S;
        }
      },
    };
  }

  const root = personById.get(opts.rootPersonId);
  if (!root) {
    return { nodes: [], edges: [], width: 0, height: 0, generations: [] };
  }
  const rootGen = root.generation;

  const sub = build(opts.rootPersonId);
  // 把根的 husband.center 放在 X=0；之后再统一平移到正坐标系
  sub.place(0);

  const minX = Math.min(...nodes.map((n) => n.x));
  const maxX = Math.max(...nodes.map((n) => n.x + NODE_W));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxY = Math.max(...nodes.map((n) => n.y + NODE_H));

  for (const n of nodes) {
    n.x -= minX;
    n.y -= minY;
  }

  const generations = Array.from(
    new Set(nodes.map((n) => n.person.generation)),
  ).sort((a, b) => a - b);

  return {
    nodes,
    edges,
    width: maxX - minX,
    height: maxY - minY,
    generations,
  };
}

export const TREE_LAYOUT_CONSTS = { NODE_W, NODE_H, H_GAP, SPOUSE_GAP, V_GAP };
