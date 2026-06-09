/**
 * 吊线图分块（纯逻辑，无 React / 无客户端依赖）——服务端 / PDF 专用副本。
 *
 * 为什么单独一份：屏幕端的分块在 components/album/PagodaPages.tsx，但那里同文件
 * import 了客户端 SVG 组件（LineageChartSvg），服务端（lib/services/album）/
 * PDF（lib/pdf/album）若从那里 import 会把客户端组件拉进 bundle。这里只依赖纯模块
 * （tree-data、lib/services/lineage-chart），供 buildAlbumBook 计算 PDF 用的分块。
 *
 * ⚠️ 与 components/album/PagodaPages.tsx 的 chunkLineage / toLineageInputs 保持一致；
 *    改分块规则时两处同步（屏幕端那份后续可改为从这里 re-export 以彻底去重）。
 */
import {
  buildTreeData,
  type TreePerson,
  type TreeEdge,
  type TreeMarriage,
} from "@/components/album/tree-data";

// 顺带 re-export，让服务端（lib/services/album）只从服务层取 buildTreeData，
// 不直接反向依赖 components。
export { buildTreeData };
import {
  layoutLineageChart,
  type LineagePerson,
  type LineageEdgeIn,
  type LineageMarriageIn,
} from "@/lib/services/lineage-chart";

const MAX_GEN_PER_CHART = 5; // 每图最多 5 代（与欧式 5 列对齐，便于图录配对）
const MAX_LEAVES_PER_CHART = 8; // 每图最多 ~8 列（控宽度 → 各图缩放一致）
const MAX_CHARTS = 9000; // 安全上限，避免病态数据无限分图

export interface LineageChunk {
  index: number;
  rootId: string;
  rootName: string;
  startGen: number;
  /** 本图涵盖的男性节点 id（供合编本"欧式详解"配对用） */
  maleIds: string[];
  layout: ReturnType<typeof layoutLineageChart>;
  continuationCount: number;
}

/**
 * 吊线图分块：整族按"≤5 代 / ≤8 列"切成若干小图（带续接点）。
 * 返回每块的 layout + 涵盖人物 id，供宝塔式与合编本（图录配对）共用。
 */
export function chunkLineage(input: {
  tree: ReturnType<typeof buildTreeData>;
  lineagePersons: LineagePerson[];
  lineageEdges: LineageEdgeIn[];
  lineageMarriages: LineageMarriageIn[];
}): LineageChunk[] {
  const chunks: LineageChunk[] = [];
  let chartIndex = 1;

  // 预建索引（避免每图都全量 filter，O(charts×N) → O(N)）
  const personById = new Map(input.lineagePersons.map((p) => [p.id, p]));
  const edgesByParent = new Map<string, LineageEdgeIn[]>();
  for (const e of input.lineageEdges) {
    const arr = edgesByParent.get(e.parentId) ?? [];
    arr.push(e);
    edgesByParent.set(e.parentId, arr);
  }
  const marriagesByHusband = new Map<string, LineageMarriageIn[]>();
  const wivesOf = new Map<string, string[]>();
  for (const m of input.lineageMarriages) {
    const arr = marriagesByHusband.get(m.husbandId) ?? [];
    arr.push(m);
    marriagesByHusband.set(m.husbandId, arr);
    const w = wivesOf.get(m.husbandId) ?? [];
    w.push(m.wifeId);
    wivesOf.set(m.husbandId, w);
  }

  const visited = new Set<string>();
  const queue: { rootId: string; startGen: number }[] = [];
  for (const r of input.tree.rootIds) {
    const root = input.tree.personById.get(r);
    if (root) queue.push({ rootId: r, startGen: root.generation });
  }

  while (queue.length > 0 && chartIndex <= MAX_CHARTS) {
    const { rootId } = queue.shift()!;
    if (visited.has(rootId)) continue;
    visited.add(rootId);

    // 逐层 BFS：深度封顶 MAX_GEN_PER_CHART，宽度封顶 MAX_LEAVES_PER_CHART。
    const chunkMales = new Set<string>([rootId]);
    const continuations: string[] = [];
    let frontier: string[] = [rootId];
    for (let level = 1; level < MAX_GEN_PER_CHART; level++) {
      const next: string[] = [];
      for (const f of frontier) {
        for (const k of input.tree.childrenOf.get(f) ?? []) next.push(k);
      }
      if (next.length === 0) {
        frontier = [];
        break;
      }
      // 第 1 层（始祖之子）始终并入，避免"独父多子"空转；第 2 层起才限宽
      if (level >= 2 && next.length > MAX_LEAVES_PER_CHART) {
        for (const f of frontier) {
          if ((input.tree.childrenOf.get(f) ?? []).length > 0) continuations.push(f);
        }
        frontier = [];
        break;
      }
      for (const k of next) chunkMales.add(k);
      frontier = next;
    }
    for (const f of frontier) {
      if ((input.tree.childrenOf.get(f) ?? []).length > 0) continuations.push(f);
    }

    // 连同元配纳入 persons 子集
    const chunkIds = new Set<string>(chunkMales);
    for (const m of chunkMales) for (const w of wivesOf.get(m) ?? []) chunkIds.add(w);
    const persons: LineagePerson[] = [];
    for (const id of chunkIds) {
      const p = personById.get(id);
      if (p) persons.push(p);
    }
    const edges: LineageEdgeIn[] = [];
    const marriages: LineageMarriageIn[] = [];
    for (const m of chunkMales) {
      for (const e of edgesByParent.get(m) ?? []) if (chunkMales.has(e.childId)) edges.push(e);
      for (const mar of marriagesByHusband.get(m) ?? []) marriages.push(mar);
    }

    const layout = layoutLineageChart({ rootPersonId: rootId, persons, parentChild: edges, marriages });
    const root = input.tree.personById.get(rootId);
    if (layout.nodes.length > 0 && root) {
      chunks.push({
        index: chartIndex++,
        rootId,
        rootName: root.name,
        startGen: root.generation,
        maleIds: [...chunkMales],
        layout,
        continuationCount: continuations.length,
      });
    }

    for (const c of continuations) {
      if (visited.has(c)) continue;
      const cp = input.tree.personById.get(c);
      if (cp) queue.push({ rootId: c, startGen: cp.generation });
    }
  }
  return chunks;
}

/** 把 TreePerson / TreeEdge / TreeMarriage 转成 lineage-chart 需要的入参。 */
export function toLineageInputs(input: {
  persons: TreePerson[];
  parentChild: TreeEdge[];
  marriages: TreeMarriage[];
}): {
  lineagePersons: LineagePerson[];
  lineageEdges: LineageEdgeIn[];
  lineageMarriages: LineageMarriageIn[];
} {
  return {
    lineagePersons: input.persons.map((p) => ({
      id: p.id,
      name: p.name,
      alias: p.alias,
      generation: p.generation,
      generationChar: p.generationChar,
      gender: p.gender,
      isMarriedIn: p.isMarriedIn,
      birthOrder: p.birthOrder,
      birthYear: p.birthYear,
      deathYear: p.deathYear,
      status: "ALIVE",
      succession: null,
    })),
    lineageEdges: input.parentChild.map((e) => ({
      parentId: e.parentId,
      childId: e.childId,
      birthOrder: e.birthOrder,
    })),
    lineageMarriages: input.marriages.map((m) => ({
      husbandId: m.husbandId,
      wifeId: m.wifeId,
      type: m.type,
      order: m.order,
    })),
  };
}
