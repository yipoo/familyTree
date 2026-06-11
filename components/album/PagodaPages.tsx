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
import { layoutLineageChart } from "@/lib/services/lineage-chart";
import { LineageChartSvg } from "@/components/charts/LineageChartSvg";
import {
  chunkLineage,
  toLineageInputs,
  type LineageChunk,
} from "@/lib/services/lineage-chunks";

import {
  buildTreeData,
  type TreeEdge,
  type TreeMarriage,
  type TreePerson,
} from "./tree-data";
import type { AlbumBuild, AlbumIndexEntry } from "./album-index";

// 分块逻辑统一在 lib/services/lineage-chunks.ts（服务端/PDF/屏幕端共用，参数一处生效）；
// 此处 re-export 以兼容既有引用。
export { chunkLineage, toLineageInputs, type LineageChunk } from "@/lib/services/lineage-chunks";

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

/** 固定参考宽度：所有图统一缩放比例、字号一致（屏幕端渲染用）。 */
const ALBUM_CHART_REF_W = 880;

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
