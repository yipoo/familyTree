/**
 * 欧式（欧阳修体）—— 横排表格
 *
 * 排版规则（清以后通行）：
 *   - 横列代序：左→右一代一列
 *   - 5 世为一图（一页）；第 6 世起另起一图，首列**重列**第 5 世人物做接续
 *   - 每格大字写名，小字注字号 / 生卒
 *   - 兄弟同列上下排列；父子靠"父行 rowSpan = 子总人数"自然对齐
 *   - 不画连线
 *
 * 算法：
 *   - 对每个根递归，按 (generation - startGen + 1) 截到 5。
 *     深度=5 且仍有子嗣的人物登记为续接点，单独再开新图。
 *   - 用 HTML <table> + rowSpan 精确表达父子归并。
 *
 * 数据：buildTreeData(persons, parentChild, marriages)
 */
import type { AlbumBook } from "@/lib/services/album";
import {
  buildTreeData,
  shortPersonAnnotation,
  type TreeData,
  type TreeEdge,
  type TreeMarriage,
  type TreePerson,
} from "./tree-data";
import type { AlbumBuild, AlbumIndexEntry } from "./album-index";

const COLS_PER_PAGE = 5;

interface Cell {
  person: TreePerson;
  rowSpan: number;
  /** 该单元在本图最末列且仍有子嗣 → 续接点 */
  isContinuation: boolean;
}

interface Row {
  cells: Cell[]; // 已按列序填好；空列由 colSpan 模拟
  startCol: number; // cells[0] 所在列号（0-based）
}

export function buildOuyangPages(input: {
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

  // 队列：每个 chunk 是一张图（5 列）
  type Chunk = { rootId: string; startGen: number; chunkIndex: number };
  const visited = new Set<string>();
  const queue: Chunk[] = [];
  let chunkSeq = 1;

  for (const r of tree.rootIds) {
    const root = tree.personById.get(r);
    if (!root) continue;
    queue.push({ rootId: r, startGen: root.generation, chunkIndex: chunkSeq++ });
  }

  while (queue.length > 0) {
    const chunk = queue.shift()!;
    if (visited.has(chunk.rootId)) continue;
    visited.add(chunk.rootId);

    const continuations: string[] = [];
    const rows = layoutChunk(chunk.rootId, chunk.startGen, tree, continuations);
    const pageIdx = pages.length;
    pages.push(
      <OuyangPage
        rows={rows}
        startGen={chunk.startGen}
        chunkIndex={chunk.chunkIndex}
        rootName={tree.personById.get(chunk.rootId)?.name ?? "—"}
        spousesOf={tree.spousesOf}
        personById={tree.personById}
      />,
    );
    for (const row of rows) {
      for (const cell of row.cells) {
        if (cell.isContinuation) continue; // 续接点在其本图再索引，避免重复
        index.push({
          name: cell.person.name,
          alias: cell.person.alias,
          generation: cell.person.generation,
          page: pageIdx,
        });
      }
    }

    // 续接点：每人开新图，首列重列该人物（startGen 设为该人物本身的世代）
    for (const c of continuations) {
      if (visited.has(c)) continue;
      const p = tree.personById.get(c);
      if (!p) continue;
      queue.push({
        rootId: c,
        startGen: p.generation, // 新图里他自身就是第 1 列
        chunkIndex: chunkSeq++,
      });
    }
  }

  pages.push(epilogue(book));
  return { pages, index };
}

function layoutChunk(
  rootId: string,
  startGen: number,
  tree: TreeData,
  continuations: string[],
): Row[] {
  const rows: Row[] = [];

  // 返回 [子树占行数, 该子树第一行需要 prepend 的祖先单元]
  // 写成迭代式：先 buildLeaves，再回填祖先 rowSpan。这里用纯递归实现更清晰。
  function build(personId: string): Row[] {
    const p = tree.personById.get(personId);
    if (!p) return [];
    const depth = p.generation - startGen + 1; // 1..5
    const children = tree.childrenOf.get(personId) ?? [];
    const reachedMaxDepth = depth >= COLS_PER_PAGE;
    const isContinuation = reachedMaxDepth && children.length > 0;
    if (isContinuation) continuations.push(personId);

    if (reachedMaxDepth || children.length === 0) {
      return [
        {
          startCol: depth - 1,
          cells: [
            {
              person: p,
              rowSpan: 1,
              isContinuation,
            },
          ],
        },
      ];
    }
    const childRows: Row[] = [];
    for (const cid of children) {
      childRows.push(...build(cid));
    }
    if (childRows.length === 0) {
      return [
        {
          startCol: depth - 1,
          cells: [{ person: p, rowSpan: 1, isContinuation: false }],
        },
      ];
    }
    // 把自己 prepend 到第一行的开头
    childRows[0] = {
      startCol: depth - 1,
      cells: [
        { person: p, rowSpan: childRows.length, isContinuation: false },
        ...childRows[0].cells,
      ],
    };
    return childRows;
  }

  rows.push(...build(rootId));
  return rows;
}

function OuyangPage({
  rows,
  startGen,
  chunkIndex,
  rootName,
  spousesOf,
  personById,
  headerTitle,
  footerNote,
}: {
  rows: Row[];
  startGen: number;
  chunkIndex: number;
  rootName: string;
  /** 传入则在每格附"配 妻…"（欧式详解含妻室信息） */
  spousesOf?: Map<string, string[]>;
  personById?: Map<string, TreePerson>;
  headerTitle?: string;
  footerNote?: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-baseline justify-between border-b border-zinc-300 pb-1.5">
        <h3
          className="text-base font-medium text-zinc-900"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {headerTitle ?? `图 ${chunkIndex} · 自 ${startGen} 世「${rootName}」起`}
        </h3>
        <span className="text-[10px] text-zinc-500">5 世为一图</span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse text-[12px]">
          <thead>
            <tr>
              {Array.from({ length: COLS_PER_PAGE }, (_, i) => (
                <th
                  key={i}
                  className="border border-zinc-400 bg-zinc-100 px-1 py-1 text-center text-[11px] font-medium text-zinc-600"
                  style={{ width: `${100 / COLS_PER_PAGE}%` }}
                >
                  {startGen + i} 世
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              // 用 startCol 决定前导空列；继续生成 cells，最后用占位空列补足右侧
              return (
                <tr key={rowIdx}>
                  {/* 前导空列（仅首行需要；后续行由上方 rowSpan 自然占去——
                      但这里我们已经把祖先合并到了第一行的 cells 里，所以不需要 leading 空列）*/}
                  {row.cells.map((c, ci) => {
                    const wives =
                      spousesOf && personById
                        ? (spousesOf.get(c.person.id) ?? [])
                            .map((id) => personById.get(id)?.name ?? "")
                            .filter((n) => n)
                        : [];
                    return (
                      <td
                        key={`${rowIdx}-${ci}`}
                        rowSpan={c.rowSpan}
                        className={`align-top border border-zinc-300 px-1.5 py-1.5 ${
                          c.isContinuation ? "bg-amber-50" : ""
                        }`}
                      >
                        <div className="flex items-baseline gap-1">
                          <span
                            className="text-sm font-medium text-zinc-900"
                            style={{ fontFamily: "var(--font-serif)" }}
                          >
                            {c.person.name}
                          </span>
                          {c.person.generationChar && (
                            <span className="text-[9px] text-zinc-500">
                              {c.person.generationChar}
                            </span>
                          )}
                          {c.isContinuation && (
                            <span className="text-[9px] text-amber-700">(续)</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[10px] leading-4 text-zinc-500">
                          {shortPersonAnnotation(c.person) || "—"}
                        </div>
                        {wives.length > 0 && (
                          <div className="text-[10px] leading-4 text-rose-700/80">
                            配 {wives.join("、")}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-zinc-400">
        {footerNote ?? "续接点（黄底）人物在新图首列重列，继续展开后嗣"}
      </p>
    </div>
  );
}

/**
 * 合编本"图录配对"用：为一个吊线图分块（同一批男性）生成对应的欧式详解表
 * （含妻室、字号、生卒），与该图一一对应。
 */
export function buildOuyangDetailForChunk(input: {
  rootId: string;
  startGen: number;
  maleIds: string[];
  tree: TreeData;
}): React.ReactNode {
  const maleSet = new Set(input.maleIds);
  // 把 childrenOf 限制到本块，layoutChunk 即只铺这批人
  const restrictedChildrenOf = new Map<string, string[]>();
  for (const id of input.maleIds) {
    restrictedChildrenOf.set(
      id,
      (input.tree.childrenOf.get(id) ?? []).filter((k) => maleSet.has(k)),
    );
  }
  const restrictedTree: TreeData = { ...input.tree, childrenOf: restrictedChildrenOf };
  const rows = layoutChunk(input.rootId, input.startGen, restrictedTree, []);
  const rootName = input.tree.personById.get(input.rootId)?.name ?? "—";
  return (
    <OuyangPage
      key={`detail-${input.rootId}`}
      rows={rows}
      startGen={input.startGen}
      chunkIndex={0}
      rootName={rootName}
      spousesOf={input.tree.spousesOf}
      personById={input.tree.personById}
      headerTitle={`世系详录 · 自 ${input.startGen} 世「${rootName}」起`}
      footerNote="上图各人之字号、生卒、配偶（妻）详录于此，与前页吊线图一一对应。"
    />
  );
}

function coverPage(book: AlbumBook) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-xs tracking-[0.3em] text-zinc-500">
        {book.family.surname} 氏 · 欧式
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
          欧式者，宋欧阳文忠（修）所创也。其法横列代序、左右排列，
          通常五世为一图。一图既毕，第六世以下另起一图，首列重列第五世
          人物做接续，使阅者按图索骥而不至迷于代远人多。
        </p>
        <p className="indent-8">
          每格大字书姓名，小字注字号生卒。兄弟同列上下排列，
          父子隔行靠左对齐，省略连线，赖位置自明。
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
        ——欧式纂毕，共录 {book.totalPersons} 人——
      </div>
    </div>
  );
}
