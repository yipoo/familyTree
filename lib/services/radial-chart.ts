/**
 * 族谱圆（同心圆 / 径向世系图）布局（纯算法）
 *
 * 以始祖（root）为圆心，每代为一圈（同代同环），后代沿父系向外辐射。
 * 角度按子树叶子数分配，使最外圈均匀铺开——一种适合手机 pan/zoom、
 * 也更"年轻化"的世系可视化，区别于左右铺开的关系树。
 *
 * 输出节点坐标 + 连线 + 环半径，组件直接渲染 SVG。纯函数，便于单测。
 */

export interface RadialPerson {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  birthYear?: number | null;
  birthOrder?: number | null;
}

export interface RadialParentChild {
  parentId: string;
  childId: string;
  isPrimary?: boolean;
}

export interface RadialNode {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  depth: number; // 0 = 始祖
  angle: number; // 度，0 在正上方，顺时针
  x: number;
  y: number;
}

export interface RadialLink {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RadialChart {
  nodes: RadialNode[];
  links: RadialLink[];
  rings: number[]; // 各环半径（用于画背景圆）
  size: number; // SVG 边长（正方形）
  center: number; // cx = cy
  maxDepth: number;
  rootName: string;
  truncated: boolean; // 是否因层数/节点数上限被截断
  shown: number; // 实际展示节点数
}

interface TreeNode {
  person: RadialPerson;
  depth: number;
  children: TreeNode[];
  leaves: number;
  angle: number;
}

export interface RadialOptions {
  ringStep?: number;
  maxDepth?: number;
  maxNodes?: number;
  margin?: number;
}

export function layoutRadialChart(
  input: {
    rootPersonId: string;
    persons: RadialPerson[];
    parentChild: RadialParentChild[];
  },
  opts: RadialOptions = {},
): RadialChart | null {
  const ringStep = opts.ringStep ?? 92;
  const maxDepth = opts.maxDepth ?? 7;
  const maxNodes = opts.maxNodes ?? 900;
  const margin = opts.margin ?? 60;

  const byId = new Map(input.persons.map((p) => [p.id, p]));
  const root = byId.get(input.rootPersonId);
  if (!root) return null;

  // 子女索引
  const childrenOf = new Map<string, string[]>();
  for (const pc of input.parentChild) {
    if (!byId.has(pc.parentId) || !byId.has(pc.childId)) continue;
    (childrenOf.get(pc.parentId) ?? childrenOf.set(pc.parentId, []).get(pc.parentId)!).push(pc.childId);
  }

  const visited = new Set<string>();
  let truncated = false;
  let count = 0;

  function sortChildren(ids: string[]): RadialPerson[] {
    return ids
      .map((id) => byId.get(id)!)
      .filter(Boolean)
      .sort((a, b) => {
        const ao = a.birthOrder ?? Number.POSITIVE_INFINITY;
        const bo = b.birthOrder ?? Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        const ay = a.birthYear ?? Number.POSITIVE_INFINITY;
        const by = b.birthYear ?? Number.POSITIVE_INFINITY;
        if (ay !== by) return ay - by;
        return a.name.localeCompare(b.name, "zh");
      });
  }

  function build(person: RadialPerson, depth: number): TreeNode {
    visited.add(person.id);
    count++;
    const node: TreeNode = { person, depth, children: [], leaves: 0, angle: 0 };
    if (depth >= maxDepth) {
      if ((childrenOf.get(person.id) ?? []).some((c) => !visited.has(c))) truncated = true;
      node.leaves = 1;
      return node;
    }
    const kids = sortChildren(childrenOf.get(person.id) ?? []).filter((c) => !visited.has(c.id));
    for (const kid of kids) {
      if (count >= maxNodes) {
        truncated = true;
        break;
      }
      node.children.push(build(kid, depth + 1));
    }
    node.leaves = node.children.length === 0 ? 1 : node.children.reduce((s, c) => s + c.leaves, 0);
    return node;
  }

  const tree = build(root, 0);

  // 角度分配：root 占 [0,360)；按 leaves 比例切分给子女
  function assignAngles(node: TreeNode, start: number, end: number) {
    node.angle = (start + end) / 2;
    if (node.children.length === 0) return;
    let cur = start;
    const span = end - start;
    for (const child of node.children) {
      const frac = child.leaves / node.leaves;
      const cEnd = cur + span * frac;
      assignAngles(child, cur, cEnd);
      cur = cEnd;
    }
  }
  assignAngles(tree, 0, 360);

  // 收集节点 + 连线
  const nodes: RadialNode[] = [];
  const links: RadialLink[] = [];
  const radiusOf = (depth: number) => depth * ringStep;
  const maxR = radiusOf(Math.min(maxDepth, deepest(tree)));
  const size = (maxR + margin) * 2;
  const center = size / 2;

  const toXY = (depth: number, angleDeg: number) => {
    const r = radiusOf(depth);
    const rad = ((angleDeg - 90) * Math.PI) / 180; // 0 度在正上方
    return { x: center + r * Math.cos(rad), y: center + r * Math.sin(rad) };
  };

  function walk(node: TreeNode) {
    const pos = toXY(node.depth, node.angle);
    nodes.push({
      id: node.person.id,
      name: node.person.name,
      gender: node.person.gender,
      depth: node.depth,
      angle: node.angle,
      x: pos.x,
      y: pos.y,
    });
    for (const child of node.children) {
      const cpos = toXY(child.depth, child.angle);
      links.push({ x1: pos.x, y1: pos.y, x2: cpos.x, y2: cpos.y });
      walk(child);
    }
  }
  walk(tree);

  const depthShown = Math.min(maxDepth, deepest(tree));
  const rings: number[] = [];
  for (let d = 1; d <= depthShown; d++) rings.push(radiusOf(d));

  return {
    nodes,
    links,
    rings,
    size,
    center,
    maxDepth: depthShown,
    rootName: root.name,
    truncated,
    shown: nodes.length,
  };
}

function deepest(node: TreeNode): number {
  if (node.children.length === 0) return node.depth;
  return Math.max(...node.children.map(deepest));
}
