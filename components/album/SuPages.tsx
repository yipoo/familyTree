/**
 * 苏式（苏洵体）—— 纵排叠层缩进列表
 *
 * 排版规则：
 *   - DFS 前序遍历：父，然后逐子递归
 *   - 每行一人，缩进按代差 = (gen - 起始 gen) × 1.5em
 *   - 不画连线，靠相邻 / 缩进表达父子兄弟
 *   - 每页约 22 行，超出分页（接续页加"接前页"提示）
 *
 * 数据来源：buildTreeData(persons, parentChild, marriages)
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

interface Line {
  person: TreePerson;
  depth: number;
  spouseNames: string[];
}

const LINES_PER_PAGE = 22;

export function buildSuPages(input: {
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

  // 封面
  pages.push(coverPage(book));

  // 目录与体例小注
  pages.push(intro(book));

  // 每个根独立成卷（如果有多个根，比如多支离散始祖）
  for (const rootId of tree.rootIds) {
    const lines = collectLines(rootId, tree);
    if (lines.length === 0) continue;

    // 卷扉页
    const root = tree.personById.get(rootId)!;
    pages.push(volumeCover(root, lines.length));

    // 内容分页
    for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
      const slice = lines.slice(i, i + LINES_PER_PAGE);
      const pageIdx = pages.length;
      pages.push(
        <SuPagePart
          slice={slice}
          rootName={root.name}
          isContinued={i > 0}
        />,
      );
      for (const l of slice) {
        index.push({
          name: l.person.name,
          alias: l.person.alias,
          generation: l.person.generation,
          page: pageIdx,
        });
      }
    }
  }

  // 跋
  pages.push(epilogue(book));
  return { pages, index };
}

function collectLines(rootId: string, tree: TreeData): Line[] {
  const lines: Line[] = [];
  const root = tree.personById.get(rootId);
  if (!root) return lines;
  const startGen = root.generation;

  function visit(personId: string) {
    const p = tree.personById.get(personId);
    if (!p) return;
    const spouseIds = tree.spousesOf.get(personId) ?? [];
    const spouseNames = spouseIds
      .map((id) => tree.personById.get(id)?.name)
      .filter((n): n is string => !!n);
    lines.push({ person: p, depth: p.generation - startGen, spouseNames });
    const children = tree.childrenOf.get(personId) ?? [];
    for (const cid of children) visit(cid);
  }
  visit(rootId);
  return lines;
}

function SuPagePart({
  slice,
  rootName,
  isContinued,
}: {
  slice: Line[];
  rootName: string;
  isContinued: boolean;
}) {
  // 缩进按"本页最小代"重定基 + 封顶，避免深世代（如 20+ 世）缩进过深把名字挤成竖排
  const minDepth = slice.length ? Math.min(...slice.map((l) => l.depth)) : 0;
  const indentEm = (depth: number) => Math.min(depth - minDepth, 10) * 1.25;
  return (
    <div className="flex h-full flex-col">
      <h3
        className="mb-3 flex items-baseline gap-2 border-b border-zinc-300 pb-1 text-base font-medium text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {rootName} 支
        {isContinued && (
          <span className="text-xs font-normal text-zinc-500">（接前页）</span>
        )}
      </h3>
      <ol className="flex-1 space-y-0.5 text-[12.5px] leading-6 text-zinc-800">
        {slice.map((l, i) => (
          <li
            key={`${l.person.id}-${i}`}
            className="flex items-baseline gap-2 whitespace-nowrap"
            style={{ paddingLeft: `${indentEm(l.depth)}em` }}
          >
            <span className="shrink-0 text-[10px] text-zinc-400 tabular-nums">
              {l.person.generation}世
            </span>
            <span
              className="font-medium text-zinc-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {l.person.name}
            </span>
            {l.person.generationChar && (
              <span className="text-[10px] text-zinc-500">
                {l.person.generationChar}
              </span>
            )}
            {l.spouseNames.length > 0 && (
              <span className="text-[11px] text-zinc-500">
                配 {l.spouseNames.join("、")}
              </span>
            )}
            <span className="text-[11px] text-zinc-500">
              {shortPersonAnnotation(l.person)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// 公用页（封面 / 序 / 卷扉 / 跋）
function coverPage(book: AlbumBook) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-xs tracking-[0.3em] text-zinc-500">
        {book.family.surname} 氏 · 苏式
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
      <p className="mt-1 text-[11px] text-zinc-400">
        共 {book.totalPersons} 人
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
          苏式者，宋苏明允（洵）所创也。其法纵列代序、自上而下，
          子嗣较父辈右缩一格，靠层级缩进示父子，相邻示兄弟，不假连线。
          质朴紧凑，便于木版刻印，旧时家乘多沿用之。
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

function volumeCover(root: TreePerson, count: number) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-xs tracking-widest text-zinc-500">支系扉页</p>
      <h2
        className="mt-4 text-2xl font-semibold tracking-widest text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {root.name} 支
      </h2>
      <p className="mt-1 text-xs text-zinc-500">第 {root.generation} 世起</p>
      <p className="mt-6 text-sm text-zinc-500">收录 {count} 人</p>
    </div>
  );
}

function epilogue(book: AlbumBook) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="text-xs italic text-zinc-500">
        ——苏式纂毕，共录 {book.totalPersons} 人——
      </div>
    </div>
  );
}
