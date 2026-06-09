/**
 * 宝塔式 —— 顶端始祖、向下展开的对称图
 *
 * 排版规则：
 *   - 始祖居顶居中
 *   - 每代向下分支水平居中、等距分布
 *   - 父→子画直角连线
 *   - 整体形似倒置宝塔
 *
 * 实现：直接复用 lib/services/lineage-chart 的算法 + LineageChartSvg 渲染。
 *   - 多个分支：每个根 1 页（封面 + 序 + 跋 之外）
 *   - SVG 自适应到书页（`width=100%` + `viewBox`，长树会变小但保留全貌）
 */
import type { AlbumBook } from "@/lib/services/album";
import {
  layoutLineageChart,
  type LineagePerson,
  type LineageEdgeIn,
  type LineageMarriageIn,
} from "@/lib/services/lineage-chart";
import { LineageChartSvg } from "@/components/charts/LineageChartSvg";

import {
  buildTreeData,
  type TreeEdge,
  type TreeMarriage,
  type TreePerson,
} from "./tree-data";
import type { AlbumBuild, AlbumIndexEntry } from "./album-index";

export function buildPagodaPages(input: {
  book: AlbumBook;
  persons: TreePerson[];
  parentChild: TreeEdge[];
  marriages: TreeMarriage[];
}): AlbumBuild {
  const { book } = input;
  const tree = buildTreeData({
    persons: input.persons,
    parentChild: input.parentChild,
    marriages: input.marriages,
  });

  const pages: React.ReactNode[] = [];
  const index: AlbumIndexEntry[] = [];
  pages.push(coverPage(book));
  pages.push(intro(book));

  const generationChars: Record<number, string> = Object.fromEntries(
    book.generationNames.map((g) => [g.generation, g.character]),
  );

  const chunks = chunkLineage({
    tree,
    ...toLineageInputs({
      persons: input.persons,
      parentChild: input.parentChild,
      marriages: input.marriages,
    }),
  });
  for (const c of chunks) {
    const pageIdx = pages.length;
    pages.push(buildPagodaChartPage(c, generationChars, book.family.name));
    for (const id of c.maleIds) {
      const p = tree.personById.get(id);
      if (p) index.push({ name: p.name, alias: p.alias, generation: p.generation, page: pageIdx });
    }
  }

  pages.push(epilogue(book));
  return { pages, index };
}

/**
 * 仅生成"图谱正文"页（不含封面 / 序 / 跋），供合编本复用。
 *
 * 关键：吊线图按 **5 世为一图** 分块——一棵大族（数千节点）若挤进一页会缩成
 * 不可见的一团；故沿用欧式的"续接点"思路：每图至多 5 代，第 5 代仍有子嗣者
 * 作为续接点，在新图首列以其自身为根重画，直到全族画完。这样每图都清晰可读。
 */
const MAX_GEN_PER_CHART = 5; // 每图最多 5 代（与欧式 5 列对齐，便于图录配对）
const MAX_LEAVES_PER_CHART = 8; // 每图最多 ~8 列（控宽度 → 各图缩放一致）
const ALBUM_CHART_REF_W = 880; // 固定参考宽度：所有图统一缩放比例、字号一致
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
    const { rootId, startGen } = queue.shift()!;
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

/** 渲染单块吊线图为一页（供合编本图录配对逐块复用）。 */
export function buildPagodaChartPage(
  chunk: LineageChunk,
  generationChars: Record<number, string>,
  familyName: string,
): React.ReactNode {
  return (
    <PagodaPage
      key={`chart-${chunk.rootId}`}
      index={chunk.index}
      layout={chunk.layout}
      rootName={chunk.rootName}
      startGen={chunk.startGen}
      generationChars={generationChars}
      familyName={familyName}
      continuationCount={chunk.continuationCount}
    />
  );
}

export function buildPagodaChartBody(input: {
  tree: ReturnType<typeof buildTreeData>;
  lineagePersons: LineagePerson[];
  lineageEdges: LineageEdgeIn[];
  lineageMarriages: LineageMarriageIn[];
  generationChars: Record<number, string>;
  familyName: string;
}): React.ReactNode[] {
  return chunkLineage(input).map((c) =>
    buildPagodaChartPage(c, input.generationChars, input.familyName),
  );
}

/** 把 TreePerson / TreeEdge / TreeMarriage 转成 lineage-chart 需要的入参 */
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

function PagodaPage({
  index,
  layout,
  rootName,
  startGen,
  generationChars,
  familyName,
  continuationCount = 0,
}: {
  index: number;
  layout: ReturnType<typeof layoutLineageChart>;
  rootName: string;
  startGen: number;
  generationChars: Record<number, string>;
  familyName: string;
  continuationCount?: number;
}) {
  return (
    <div className="flex h-full flex-col">
      <h3
        className="mb-2 flex items-baseline justify-between border-b border-zinc-300 pb-1.5 text-base font-medium text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        <span>
          图 {index} · 自 {startGen} 世「{rootName}」起
        </span>
        <span className="text-[10px] text-zinc-500">
          {layout.nodes.length} 人 · {layout.generations.length} 代
        </span>
      </h3>
      <div className="flex-1 overflow-auto">
        <LineageChartSvg
          layout={layout}
          title={`${familyName}`}
          subtitle={`${rootName} 起 · 共 ${layout.generations.length} 代 · ${layout.nodes.length} 人`}
          generationChars={Object.fromEntries(
            Object.entries(generationChars).map(([k, v]) => [k, v]),
          )}
          refWidth={ALBUM_CHART_REF_W}
        />
      </div>
      {continuationCount > 0 && (
        <p className="mt-2 text-[10px] text-zinc-400">
          本图末世仍有 {continuationCount} 支子嗣，各自另起一图续展（见后图）。
        </p>
      )}
    </div>
  );
}

function coverPage(book: AlbumBook) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-xs tracking-[0.3em] text-zinc-500">
        {book.family.surname} 氏 · 宝塔式
      </p>
      <h1
        className="mt-6 text-3xl font-semibold tracking-[0.2em] text-zinc-900 sm:text-4xl"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {book.family.name}
      </h1>
      {book.family.founderName && (
        <p className="mt-3 text-sm text-zinc-600">始祖 · {book.family.founderName}</p>
      )}
      <p className="mt-12 text-[11px] text-zinc-400">
        生成于 {new Date(book.generatedAt).toLocaleDateString("zh-CN")}
      </p>
    </div>
  );
}

function intro(book: AlbumBook) {
  return (
    <div className="flex h-full flex-col">
      <h2
        className="mb-3 border-b border-zinc-300 pb-2 text-center text-2xl font-semibold tracking-widest text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        体例小注
      </h2>
      <div className="space-y-3 text-[13px] leading-7 text-zinc-700">
        <p className="indent-8">
          宝塔式者，近代图谱所常见也。始祖居顶居中，
          每代向下分支水平居中、等距分布，父→子绘直角连线。
          整体形似倒置之宝塔，顶尖底宽，视觉对称、一目了然。
        </p>
        <p className="indent-8">
          唯人多则爆宽，故宜于代数少（八世以内）或专门展示直系链。
          本族每个独立分支单独成图，共录入若干图。
        </p>
        {book.family.description && (
          <p className="indent-8 border-l-2 border-zinc-300 pl-3 italic">
            {book.family.description}
          </p>
        )}
      </div>
    </div>
  );
}

function epilogue(book: AlbumBook) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="text-xs italic text-zinc-500">
        ——宝塔式纂毕，共录 {book.totalPersons} 人——
      </div>
    </div>
  );
}
