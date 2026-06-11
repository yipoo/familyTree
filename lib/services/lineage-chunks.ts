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

// 参照 1995 四修谱版式放宽：每图 6 代 / ~14 列（旧 5 代 8 列致丁氏 1159 块、
// 平均仅 7.4 人/块，页面稀疏）。调整后约 870 块、9.5 人/块，再经 packLineageChunks
// 小块打包后页数减半以上。
const MAX_GEN_PER_CHART = 6; // 每图最多 6 代（1995 谱一页世系图为 16—21 世六代）
const MAX_LEAVES_PER_CHART = 14; // 每图最多 ~14 列
const MAX_CHARTS = 9000; // 安全上限，避免病态数据无限分图

/** 详录每行 6 列（与 MAX_GEN_PER_CHART 对齐）。 */
export const DETAIL_COLS = MAX_GEN_PER_CHART;

/** 欧式详录一个单元格（一个人）。 */
export interface OuyangDetailCell {
  id: string;
  name: string;
  generationChar: string | null;
  /** 字号 + 生卒 短注，如「字伯温 1900—1970」。 */
  annotation: string;
  /** 配偶（妻）姓名。 */
  wives: string[];
  /** 儿子姓名（全量，含续接到别图者），仿 1995 谱"妻某氏子三：名名名"体例。 */
  sons: string[];
  /** 0-based 列号 = generation - chunk.startGen（0..DETAIL_COLS-1），用于在网格里定位。 */
  col: number;
}

/**
 * 欧式详录一行：cells 按列号升序、可不连续（前导列留空——其祖先已在上一行铺出，
 * 靠位置自明父子，省略 rowSpan）。一行内每列至多一个 cell。
 */
export type OuyangDetailRow = OuyangDetailCell[];

export interface LineageChunk {
  index: number;
  rootId: string;
  rootName: string;
  startGen: number;
  /** 本图涵盖的男性节点 id（供合编本"欧式详解"配对用） */
  maleIds: string[];
  layout: ReturnType<typeof layoutLineageChart>;
  continuationCount: number;
  /** 与本图一一对应的欧式详录（按列横排，父子靠位置对齐）。 */
  detailRows: OuyangDetailRow[];
  /** 所属房支名（按块根人物的支系归属标注；buildAlbumBook 装载时填充），统宗块为空。 */
  branchName?: string;
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
        detailRows: buildDetailRows(
          rootId,
          root.generation,
          chunkMales,
          input.tree.childrenOf,
          personById,
          wivesOf,
        ),
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

/** 字号 + 生卒短注（与 components/album/tree-data.ts:shortPersonAnnotation 一致）。 */
function shortAnnotation(p: LineagePerson): string {
  const bits: string[] = [];
  if (p.alias) bits.push(`字${p.alias}`);
  if (p.birthYear || p.deathYear) {
    bits.push(`${p.birthYear ?? "?"}—${p.deathYear ?? ""}`);
  }
  return bits.join(" ");
}

/**
 * 为一个吊线图分块生成「欧式详录」行（与 components/album/OuyangPages.tsx:layoutChunk
 * 同构，但产出可序列化的扁平行结构，便于 react-pdf 逐行流式分页，不依赖 HTML table/rowSpan）。
 *
 * 递归规则：叶子自成一行；有子嗣者把「自己」prepend 到第一个子行的行首，其余子行原样下挂。
 * 于是兄弟自然纵向堆叠、父子靠列位（generation - startGen）对齐——正是欧式「省略连线、
 * 以位置自明」的版式。仅在 maleSet 内展开（≤5 代），续接点的后嗣在别图另展。
 */
export function buildDetailRows(
  rootId: string,
  startGen: number,
  maleSet: Set<string>,
  childrenOf: Map<string, string[]>,
  personById: Map<string, LineagePerson>,
  wivesOf: Map<string, string[]>,
): OuyangDetailRow[] {
  const cellOf = (p: LineagePerson): OuyangDetailCell => ({
    id: p.id,
    name: p.name,
    generationChar: p.generationChar,
    annotation: shortAnnotation(p),
    wives: (wivesOf.get(p.id) ?? [])
      .map((id) => personById.get(id)?.name ?? "")
      .filter((n) => n.length > 0),
    sons: (childrenOf.get(p.id) ?? [])
      .map((id) => personById.get(id)?.name ?? "")
      .filter((n) => n.length > 0),
    col: p.generation - startGen,
  });

  const build = (id: string): OuyangDetailRow[] => {
    const p = personById.get(id);
    if (!p) return [];
    const kids = (childrenOf.get(id) ?? []).filter((k) => maleSet.has(k));
    if (kids.length === 0) return [[cellOf(p)]];
    const childRows = kids.flatMap(build);
    if (childRows.length === 0) return [[cellOf(p)]];
    // 把自己接到第一个子行行首；后续兄弟行前导列留空（靠位置对齐）
    childRows[0] = [cellOf(p), ...childRows[0]];
    return childRows;
  };

  return build(rootId);
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

/** 一个"图录页组"：一页吊线图（可堆叠多个小块）+ 一页详录，仍保持图右录左对开。 */
export interface LineagePack {
  index: number;
  chunks: LineageChunk[];
  /** 组内总人数（男丁） */
  persons: number;
}

export interface PackOptions {
  /** 每页组最多容纳的人数（男丁），默认 30——超过则该块独占一组 */
  maxPersons?: number;
  /** 每页组最多堆叠的图块数，默认 3（一页 A4 竖版堆 3 张小图为宜） */
  maxChunks?: number;
}

/**
 * 小块打包（参照 1995 四修谱 p26/27 的紧凑版式）：续接切分会产生大量小块
 * （丁氏平均 <10 人/块），逐块一页图一页录则页面稀疏。这里按序贪心合并相邻
 * 小块为"页组"——一页吊线图纵向堆 1~maxChunks 张小图，详录页连排各块表格。
 * 大块（人数 ≥ maxPersons）自然独占一组。纯函数，可单测。
 */
export function packLineageChunks(
  chunks: LineageChunk[],
  opts: PackOptions = {},
): LineagePack[] {
  const maxPersons = opts.maxPersons ?? 30;
  const maxChunks = opts.maxChunks ?? 3;
  const packs: LineagePack[] = [];
  let cur: LineageChunk[] = [];
  let persons = 0;

  const flush = () => {
    if (cur.length > 0) {
      packs.push({ index: packs.length + 1, chunks: cur, persons });
      cur = [];
      persons = 0;
    }
  };

  for (const c of chunks) {
    const n = c.maleIds.length;
    const crossBranch = cur.length > 0 && cur[0].branchName !== c.branchName;
    if (cur.length > 0 && (persons + n > maxPersons || cur.length >= maxChunks || crossBranch)) {
      flush();
    }
    cur.push(c);
    persons += n;
  }
  flush();
  return packs;
}
