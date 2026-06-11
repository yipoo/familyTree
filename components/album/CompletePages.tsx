/**
 * 合编本（完整版）—— 仿传统印刷家谱的标准体例。
 *
 * 目录顺序（参照清以来通行家谱编修体例）：
 *   1. 封面
 *   2. 目录
 *   3. 凡例
 *   4. 谱序
 *   5. 姓氏源流
 *   6. 字辈表
 *   7. 修谱人员名录
 *   8. 卷一·世系图（吊线图 / 宝塔式，仅男性 + 元配小字）
 *   9. 卷二·世系传（牒记式行传，含妻、子、生卒、葬地、传记）
 *  10. 像赞（含头像与传略的族人单页特写）
 *  11. 跋
 *
 * 这是产品里最贴近"传统印刷家谱"形态的一个体例：图谱与录传配对、一一对应。
 */
import type { AlbumBook } from "@/lib/services/album";

import {
  chunkLineage,
  toLineageInputs,
  packLineageChunks,
  type LineagePack,
} from "@/lib/services/lineage-chunks";
import { LineageChartSvg } from "@/components/charts/LineageChartSvg";
import { TuluDetailTable } from "./TuluDetailTable";
import {
  buildTreeData,
  type TreeEdge,
  type TreeMarriage,
  type TreePerson,
} from "./tree-data";
import { offsetIndex, type AlbumBuild, type AlbumIndexEntry } from "./album-index";
import { parseMarkdown } from "@/lib/markdown/parse";
import { paginateBlocks } from "@/lib/markdown/paginate";
import { MarkdownBlocks } from "./MarkdownBlocks";
import { computeToc } from "@/lib/services/album-toc";
import { defaultTitleForKind, type ResolvedSection } from "@/lib/services/album-sections";
import { fanliItems } from "@/lib/services/album-templates";
import { AlbumSectionKind } from "@/lib/generated/prisma/enums";

export interface ComplianceMember {
  name: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
  joinedAt: Date;
}

export interface PortraitEntry {
  id: string;
  name: string;
  generation: number;
  generationChar: string | null;
  avatarUrl: string;
  biography: string | null;
}

export function buildCompletePages(input: {
  book: AlbumBook;
  persons: TreePerson[];
  parentChild: TreeEdge[];
  marriages: TreeMarriage[];
  members: ComplianceMember[];
  portraits: PortraitEntry[];
}): AlbumBuild {
  const { book } = input;
  const tree = buildTreeData({
    persons: input.persons,
    parentChild: input.parentChild,
    marriages: input.marriages,
  });
  const generationChars: Record<number, string> = Object.fromEntries(
    book.generationNames.map((g) => [g.generation, g.character]),
  );

  // 世系图录所需：每张吊线图后紧跟其欧式详录（含妻室），一一对应
  const lineageInputs = toLineageInputs({
    persons: input.persons,
    parentChild: input.parentChild,
    marriages: input.marriages,
  });
  const chunks = chunkLineage({ tree, ...lineageInputs });

  const ctx: SectionCtx = {
    book,
    members: input.members,
    portraits: input.portraits,
    tree,
    generationChars,
    chunks,
  };

  // 数据驱动：按 book.sections 的 order 遍历分派渲染。
  //   - enabled=false 不进册（DB 行保留）
  //   - appliesTo 空或含 "complete" 才在合编本出现
  //   - 封面由系统单独生成，不在章节流
  //   - 缺数据 / 产出 0 页的章节自动跳过（与改造前的条件 push 行为等价）
  const active = book.sections.filter(
    (s) =>
      s.enabled &&
      s.kind !== AlbumSectionKind.COVER &&
      (s.appliesTo.length === 0 || s.appliesTo.includes("complete")),
  );
  const cover = book.sections.find(
    (s) => s.kind === AlbumSectionKind.COVER && s.enabled,
  );
  const sections = active
    .map((s) => renderSection(s, ctx))
    .filter((s): s is RenderedSection => s !== null && s.pages.length > 0);

  // 图录奇偶对齐：世系图录第一张吊线图（自一世始祖起）必须落在奇数页（右页）。
  // 图录段结构为 [分隔页, 图1, 录1, 图2, 录2, …]，图与详录两页一对——
  // 图1 对齐到奇数页后，全部吊线图皆在右页、欧式详录皆在左页，正合传统对开体例
  // （同时分隔页恰落左页，与图1 同一对开）。
  // 图1 的 1-based 页码 = 累计页数 + 2（分隔页占 +1），为奇 ⇔ 累计页数为奇；
  // 不满足则在分隔页前插一张空白衬页，并同步平移该段人物索引。
  {
    let acc = 2; // 封面 + 目录
    for (const s of sections) {
      if (s.isTulu && acc % 2 === 0) {
        s.pages.unshift(blankFacingPage(book));
        if (s.index) s.index = s.index.map((e) => ({ ...e, page: e.page + 1 }));
      }
      acc += s.pages.length;
    }
  }

  // 组装：封面 + 目录 + 各章节
  const pages: React.ReactNode[] = [];
  pages.push(coverPage(book, sections.length, cover));

  const { entries } = computeToc(
    sections.map((s) => ({ title: s.title, count: s.pages.length })),
    { coverPages: 1, tocPages: 1 },
  );
  pages.push(tocPage(entries));

  const index: AlbumIndexEntry[] = [];
  let abs = pages.length; // 封面 + 目录 = 2
  for (const s of sections) {
    if (s.index && s.index.length) index.push(...offsetIndex(s.index, abs));
    pages.push(...s.pages);
    abs += s.pages.length;
  }

  return { pages, index };
}

// ---------- 数据驱动分派 ----------

type SectionCtx = {
  book: AlbumBook;
  members: ComplianceMember[];
  portraits: PortraitEntry[];
  tree: ReturnType<typeof buildTreeData>;
  generationChars: Record<number, string>;
  chunks: ReturnType<typeof chunkLineage>;
};

type RenderedSection = {
  title: string;
  pages: React.ReactNode[];
  index?: AlbumIndexEntry[];
  /** 世系图录段（用于图录奇偶对齐：图在右页、录在左页） */
  isTulu?: boolean;
};

/** 空白衬页：用于把图录第一张图垫到奇数页（右页），仿传统书籍衬页带极淡书名。 */
function blankFacingPage(book: AlbumBook) {
  return (
    <div className="flex h-full items-center justify-center">
      <p
        className="text-xs tracking-[0.6em] text-zinc-300"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {book.family.name}
      </p>
    </div>
  );
}

/**
 * 把一个解析后的章节渲染成页。返回 null = 该章节无内容（不进册、不进目录）。
 * 文本/模板章节：body 为空回退到既有模板函数（保证向后兼容）；填了 markdown 则覆盖。
 * 数据驱动章节：忽略 body，按族数据自动生成；无数据返回 null。
 */
function renderSection(sec: ResolvedSection, ctx: SectionCtx): RenderedSection | null {
  const { book } = ctx;
  const title = sec.title?.trim() || defaultTitleForKind(sec.kind);
  const hasBody = !!sec.body && sec.body.trim().length > 0;

  switch (sec.kind) {
    case AlbumSectionKind.FANLI:
      return {
        title,
        pages: hasBody
          ? markdownSectionPages(title, sec)
          : [fanliPage(book, ctx.members.length)],
      };
    case AlbumSectionKind.PREFACE:
      if (hasBody) return { title, pages: markdownSectionPages(title, sec) };
      return book.family.description ? { title, pages: [pufuXuPage(book)] } : null;
    case AlbumSectionKind.YUANLIU:
      return {
        title,
        pages: hasBody ? markdownSectionPages(title, sec) : [yuanliuPage(book)],
      };
    case AlbumSectionKind.RULES:
      if (hasBody) return { title, pages: markdownSectionPages(title, sec) };
      return book.family.familyRules
        ? { title, pages: familyRulesPages(book.family.familyRules) }
        : null;
    case AlbumSectionKind.POSTSCRIPT:
      return {
        title,
        pages: hasBody ? markdownSectionPages(title, sec) : [baPage(book)],
      };
    case AlbumSectionKind.ZIBEI:
      return book.generationNames.length > 0
        ? { title, pages: [ziBeiPage(book)] }
        : null;
    case AlbumSectionKind.COMPILERS:
      return ctx.members.length > 0
        ? { title, pages: [compilersPage(book, ctx.members)] }
        : null;
    case AlbumSectionKind.TULU:
      return buildTuluSection(title, ctx);
    case AlbumSectionKind.PORTRAITS:
      return ctx.portraits.length > 0
        ? {
            title,
            pages: portraitPages(ctx.portraits),
            index: ctx.portraits.map((p, i) => ({
              name: p.name,
              alias: null,
              generation: p.generation,
              page: i,
            })),
          }
        : null;
    case AlbumSectionKind.CUSTOM_TEXT:
      return hasBody ? { title, pages: markdownSectionPages(title, sec) } : null;
    case AlbumSectionKind.CUSTOM_IMAGE:
      return sec.imageUrl ? { title, pages: [customImagePage(title, sec)] } : null;
    case AlbumSectionKind.COVER:
    default:
      return null;
  }
}

/**
 * 跨版式前置页：把封面 + 文本/模板/自定义章节渲染成页，prepend 到牒记/欧式/苏式/宝塔。
 * 仅取 appliesTo 含该 style 的章节；数据驱动章节（字辈/修谱人员/世系图录/像赞）不跨版式，
 * 也不生成目录（TOC 只在合编本）。无适用章节时返回空数组。
 */
export function buildFrontMatterPages(book: AlbumBook, style: string): React.ReactNode[] {
  const inStyle = (s: ResolvedSection) => s.enabled && s.appliesTo.includes(style);
  const pages: React.ReactNode[] = [];

  const cover = book.sections.find((s) => s.kind === AlbumSectionKind.COVER);
  if (cover && inStyle(cover)) pages.push(coverPage(book, book.volumes.length, cover));

  for (const sec of book.sections) {
    if (sec.kind === AlbumSectionKind.COVER || !inStyle(sec)) continue;
    const title = sec.title?.trim() || defaultTitleForKind(sec.kind);
    const hasBody = !!sec.body && sec.body.trim().length > 0;
    switch (sec.kind) {
      case AlbumSectionKind.FANLI:
        pages.push(
          ...(hasBody
            ? markdownSectionPages(title, sec)
            : [fanliPage(book, book.compilerCount)]),
        );
        break;
      case AlbumSectionKind.PREFACE:
        if (hasBody) pages.push(...markdownSectionPages(title, sec));
        else if (book.family.description) pages.push(pufuXuPage(book));
        break;
      case AlbumSectionKind.YUANLIU:
        pages.push(
          ...(hasBody ? markdownSectionPages(title, sec) : [yuanliuPage(book)]),
        );
        break;
      case AlbumSectionKind.RULES:
        if (hasBody) pages.push(...markdownSectionPages(title, sec));
        else if (book.family.familyRules)
          pages.push(...familyRulesPages(book.family.familyRules));
        break;
      case AlbumSectionKind.POSTSCRIPT:
        pages.push(
          ...(hasBody ? markdownSectionPages(title, sec) : [baPage(book)]),
        );
        break;
      case AlbumSectionKind.CUSTOM_TEXT:
        if (hasBody) pages.push(...markdownSectionPages(title, sec));
        break;
      case AlbumSectionKind.CUSTOM_IMAGE:
        if (sec.imageUrl) pages.push(customImagePage(title, sec));
        break;
      default:
        break; // 数据驱动章节不跨版式
    }
  }
  return pages;
}

/**
 * 世系图录：图录页组配对（参照 1995 四修谱 p26/27 紧凑版式）。
 * 小块经 packLineageChunks 打包——图页纵向堆 1~3 张小图，详录页表格连排，
 * 仍保持"图右页、录左页"对开；产出人物索引（相对段首页码）。
 */
function buildTuluSection(title: string, ctx: SectionCtx): RenderedSection | null {
  const { chunks, tree, generationChars, book } = ctx;
  if (chunks.length === 0) return null;
  const packs = packLineageChunks(chunks);
  const pages: React.ReactNode[] = [
    sectionDivider(
      "卷之",
      "世系图录",
      "图者见族脉之大势，录者详各人之名讳、配偶、子嗣。图页或并数小图，录页表格连排，与图一一对应；按图索骥，览者了然。",
    ),
  ];
  const index: AlbumIndexEntry[] = [];
  for (const pk of packs) {
    const chartPageRel = pages.length; // 图页在本段内的相对页码
    pages.push(packChartPage(pk, generationChars, book.family.name));
    pages.push(packDetailPage(pk, book.family.name));
    for (const c of pk.chunks) {
      for (const id of c.maleIds) {
        const p = tree.personById.get(id);
        if (p) {
          index.push({
            name: p.name,
            alias: p.alias,
            generation: p.generation,
            page: chartPageRel,
          });
        }
      }
    }
  }
  return { title, pages, index, isTulu: true };
}

/** 图页：堆叠页组内的 1~3 张小吊线图（contain 等比缩入各自高度配额）。 */
function packChartPage(
  pk: LineagePack,
  generationChars: Record<number, string>,
  familyName: string,
) {
  const strChars: Record<string, string> = Object.fromEntries(
    Object.entries(generationChars).map(([k, v]) => [String(k), v]),
  );
  const n = pk.chunks.length;
  return (
    <div className="flex h-full flex-col" key={`pack-chart-${pk.index}`}>
      <h3
        className="mb-1 border-b border-zinc-300 pb-1 text-center text-sm font-medium text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {familyName} · 世系图 之{pk.index}
      </h3>
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        {pk.chunks.map((c) => (
          <div key={c.rootId} className="min-h-0" style={{ height: `${100 / n}%` }}>
            <LineageChartSvg
              layout={c.layout}
              title={`自 ${c.startGen} 世 · ${c.rootName} 公支`}
              subtitle={
                c.continuationCount > 0
                  ? `${c.maleIds.length} 人 · ${c.continuationCount} 处续接（后嗣另图）`
                  : `${c.maleIds.length} 人`
              }
              generationChars={strChars}
              fit="contain"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 录页：页组内各块的紧凑详录表格连排（与图页一一对应）。 */
function packDetailPage(pk: LineagePack, familyName: string) {
  return (
    <div className="flex h-full flex-col" key={`pack-detail-${pk.index}`}>
      <h3
        className="mb-2 border-b border-zinc-300 pb-1 text-center text-sm font-medium text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {familyName} · 世系详录 之{pk.index}
      </h3>
      <div className="min-h-0 flex-1 overflow-hidden">
        {pk.chunks.map((c) => (
          <TuluDetailTable key={c.rootId} chunk={c} />
        ))}
      </div>
      <p className="mt-1 text-center text-[10px] text-zinc-400">
        与前页世系图一一对应 · 名下注妻室与子嗣，靠列位自明父子
      </p>
    </div>
  );
}

/** 用户填了 markdown 正文时的章节渲染：标题 + markdown 分页 + 落款。 */
function markdownSectionPages(title: string, sec: ResolvedSection): React.ReactNode[] {
  const pageBlocks = paginateBlocks(parseMarkdown(sec.body ?? ""));
  return pageBlocks.map((blocks, i) => (
    <div className="flex h-full flex-col" key={i}>
      {i === 0 ? (
        <h2
          className="mb-4 border-b border-zinc-300 pb-2 text-center text-2xl font-semibold tracking-widest text-zinc-900"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {title}
        </h2>
      ) : (
        <p className="mb-3 text-xs text-zinc-500">{title}（接前页）</p>
      )}
      <div className="flex-1">
        <MarkdownBlocks blocks={blocks} />
      </div>
      {i === pageBlocks.length - 1 && sec.signature && (
        <p
          className="mt-6 text-right text-xs text-zinc-500"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {sec.signature}
        </p>
      )}
    </div>
  ));
}

/** 自定义整页图片章节（图 + 可选图注）。OSS 签名在数据装载层处理。 */
function customImagePage(title: string, sec: ResolvedSection): React.ReactNode {
  return (
    <div className="flex h-full flex-col">
      <h2
        className="mb-4 border-b border-zinc-300 pb-2 text-center text-2xl font-semibold tracking-widest text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {title}
      </h2>
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sec.imageUrl ?? ""}
          alt={title}
          className="max-h-full max-w-full object-contain"
        />
      </div>
      {sec.body && (
        <p className="mt-2 text-center text-xs text-zinc-500">{sec.body}</p>
      )}
    </div>
  );
}

// ---------- 各章节组件 ----------

function coverPage(
  book: AlbumBook,
  volumeCount: number,
  cover?: ResolvedSection,
) {
  const mainTitle = cover?.title?.trim() || book.family.name;
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      {cover?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover.imageUrl}
          alt={mainTitle}
          className="mb-6 max-h-32 max-w-[60%] object-contain"
        />
      )}
      <p className="text-xs tracking-[0.3em] text-zinc-500">
        {book.family.surname} 氏{cover?.subtitle?.trim() ? ` · ${cover.subtitle}` : " · 合编本"}
      </p>
      {/* 竖排毛笔题名（双线题签框，传统家谱封面样式）*/}
      <div className="mt-6 border-4 border-double border-zinc-800 px-7 py-9">
        <h1
          className="text-5xl font-semibold text-zinc-900"
          style={{
            fontFamily: "var(--font-brush)",
            writingMode: "vertical-rl",
            letterSpacing: "0.3em",
            lineHeight: 1.1,
          }}
        >
          {mainTitle}
        </h1>
      </div>
      {!mainTitle.includes("谱") && (
        <h2
          className="mt-4 text-lg tracking-[0.5em] text-zinc-600"
          style={{ fontFamily: "var(--font-brush)" }}
        >
          家 谱
        </h2>
      )}
      {book.family.editionInfo && (
        <p
          className="mt-3 text-base tracking-widest text-zinc-700"
          style={{ fontFamily: "var(--font-brush)" }}
        >
          ·{book.family.editionInfo}·
        </p>
      )}
      {book.family.founderName && (
        <p className="mt-6 text-sm text-zinc-700">
          始祖 ·{" "}
          <span style={{ fontFamily: "var(--font-serif)" }}>
            {book.family.founderName}
          </span>
        </p>
      )}
      <div className="mt-12 space-y-1 text-[11px] text-zinc-500">
        {cover?.signature?.trim() ? (
          <p style={{ fontFamily: "var(--font-serif)" }}>{cover.signature}</p>
        ) : (
          <p>
            {new Date(book.generatedAt).getFullYear()} 年{" "}
            {new Date(book.generatedAt).getMonth() + 1} 月 修
          </p>
        )}
        <p>
          全书共 {volumeCount} 部分 · 收录 {book.totalPersons} 人
        </p>
      </div>
    </div>
  );
}

function tocPage(entries: { title: string; page: number }[]) {
  return (
    <div className="flex h-full flex-col">
      <h2
        className="mb-4 border-b border-zinc-300 pb-2 text-center text-2xl font-semibold tracking-widest text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        目 录
      </h2>
      <ul className="flex-1 space-y-1.5 text-sm">
        {entries.map((e, i) => (
          <li
            key={i}
            className="flex items-baseline justify-between border-b border-dotted border-zinc-200 pb-1"
          >
            <span style={{ fontFamily: "var(--font-serif)" }}>{e.title}</span>
            <span className="tabular-nums text-zinc-500">
              第 {e.page} 页
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function fanliPage(book: AlbumBook, compilerCount: number) {
  const items = fanliItems(book, compilerCount);
  return (
    <div className="flex h-full flex-col">
      <h2
        className="mb-4 border-b border-zinc-300 pb-2 text-center text-2xl font-semibold tracking-widest text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        凡 例
      </h2>
      <ol className="flex-1 space-y-2 text-[13px] leading-7 text-zinc-800">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span
              className="shrink-0 text-zinc-500"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {numToHan(i + 1)}、
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function pufuXuPage(book: AlbumBook) {
  return (
    <div className="flex h-full flex-col">
      <h2
        className="mb-4 border-b border-zinc-300 pb-2 text-center text-2xl font-semibold tracking-widest text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        谱 序
      </h2>
      <div className="flex-1 space-y-3 text-[13px] leading-7 text-zinc-800">
        <p className="indent-8 whitespace-pre-wrap">{book.family.description}</p>
        <p
          className="mt-6 text-right text-xs text-zinc-500"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          —— {new Date(book.generatedAt).getFullYear()} 年 谨序
        </p>
      </div>
    </div>
  );
}

function yuanliuPage(book: AlbumBook) {
  const founder = book.family.founderName;
  // 用户填了 surnameOrigin → 优先用；否则用模板
  if (book.family.surnameOrigin) {
    return (
      <div className="flex h-full flex-col">
        <h2
          className="mb-4 border-b border-zinc-300 pb-2 text-center text-2xl font-semibold tracking-widest text-zinc-900"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          姓 氏 源 流
        </h2>
        <div className="flex-1 whitespace-pre-wrap text-[13px] leading-7 text-zinc-800">
          {book.family.surnameOrigin}
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <h2
        className="mb-4 border-b border-zinc-300 pb-2 text-center text-2xl font-semibold tracking-widest text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        姓 氏 源 流
      </h2>
      <div className="flex-1 space-y-4 text-[13px] leading-7 text-zinc-800">
        <p className="indent-8">
          <span
            className="text-base font-medium"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {book.family.surname} 氏
          </span>
          ，源远流长。{book.family.surname} 之得姓，载于经传，蕃衍于历代。
          {founder ? (
            <>
              本族始祖{" "}
              <span
                className="font-medium"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {founder} 公
              </span>{" "}
              开基本支，传衍至今。
            </>
          ) : (
            <>本族始祖之事迹，载于本谱卷一卷二。</>
          )}
        </p>
        <p className="indent-8">
          数百年来，族人散居各地，或务农、或经商、或读书入仕，
          各有功业。今值续修家谱，特为本族世系正本清源，
          俾后世子孙知所自来、知所归依。
        </p>
        <p className="indent-8 text-xs text-zinc-500">
          按：本节为本谱自动生成的源流概述。可在族谱设置中填入具体源流故事，
          本节将以其内容代之。
        </p>
      </div>
    </div>
  );
}

function familyRulesPages(rules: string): React.ReactNode[] {
  // 族规家训：尊重原文换行，按段落分页（约每页 18 行）
  const lines = rules.split(/\r?\n/);
  const LINES_PER_PAGE = 18;
  const pages: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    const slice = lines.slice(i, i + LINES_PER_PAGE);
    const isFirst = i === 0;
    const isContinued = i > 0;
    pages.push(
      <div className="flex h-full flex-col">
        {isFirst && (
          <h2
            className="mb-4 border-b border-zinc-300 pb-2 text-center text-2xl font-semibold tracking-widest text-zinc-900"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            族 规 家 训
          </h2>
        )}
        {isContinued && (
          <p className="mb-3 text-xs text-zinc-500">族规家训（接前页）</p>
        )}
        <div className="flex-1 whitespace-pre-wrap text-[13px] leading-8 text-zinc-800">
          {slice.join("\n")}
        </div>
      </div>,
    );
  }
  return pages;
}

function ziBeiPage(book: AlbumBook) {
  return (
    <div className="flex h-full flex-col">
      <h2
        className="mb-4 border-b border-zinc-300 pb-2 text-center text-2xl font-semibold tracking-widest text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        字 辈 表
      </h2>
      <p className="mb-3 text-[12px] text-zinc-500">
        本族字辈派语，依次为：
      </p>
      <div className="flex flex-wrap gap-2">
        {book.generationNames.map((g) => (
          <span
            key={g.generation}
            className="inline-flex flex-col items-center rounded border border-zinc-300 bg-white px-2 py-1.5"
          >
            <span className="text-[10px] text-zinc-500">{g.generation} 世</span>
            <span
              className="mt-0.5 text-lg font-semibold text-zinc-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {g.character}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function compilersPage(book: AlbumBook, members: ComplianceMember[]) {
  return (
    <div className="flex h-full flex-col">
      <h2
        className="mb-4 border-b border-zinc-300 pb-2 text-center text-2xl font-semibold tracking-widest text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        修 谱 人 员 名 录
      </h2>
      <p className="mb-4 text-xs text-zinc-500">
        本族 {book.family.name} 之续修，赖如下族人共襄此举，谨录其名以志：
      </p>
      <ul className="flex-1 space-y-2 text-[13px]">
        {members.map((m, i) => (
          <li
            key={i}
            className="flex items-baseline justify-between border-b border-dotted border-zinc-200 pb-2"
          >
            <span className="flex items-baseline gap-2">
              <span
                className="font-medium text-zinc-900"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {m.name}
              </span>
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">
                {roleLabel(m.role)}
              </span>
            </span>
            <span className="text-[11px] text-zinc-500">
              入修 {m.joinedAt.toLocaleDateString("zh-CN")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function sectionDivider(juan: string, title: string, note: string) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p
        className="text-sm tracking-[0.3em] text-zinc-500"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {juan}
      </p>
      <h2
        className="mt-6 text-3xl font-semibold tracking-[0.25em] text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {title}
      </h2>
      <p className="mt-10 max-w-md text-[12px] leading-7 text-zinc-600">
        {note}
      </p>
    </div>
  );
}

function portraitPages(portraits: PortraitEntry[]): React.ReactNode[] {
  // 一页一人（像左、赞右），保持像赞页庄重感
  return portraits.map((p) => (
    <div className="flex h-full flex-col" key={p.id}>
      <h3
        className="mb-3 border-b border-zinc-300 pb-1 text-center text-base font-medium text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {p.name} 像 赞
      </h3>
      <div className="flex flex-1 gap-4">
        <div className="flex w-1/2 items-start justify-center">
          <div className="overflow-hidden rounded-md border-4 border-zinc-300 bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.avatarUrl}
              alt={p.name}
              className="h-56 w-44 object-cover"
            />
          </div>
        </div>
        <div className="flex w-1/2 flex-col">
          <p className="text-[11px] text-zinc-500">
            第 {p.generation} 世{p.generationChar && ` · ${p.generationChar}`}
          </p>
          <h4
            className="mt-1 text-xl font-semibold text-zinc-900"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {p.name}
          </h4>
          {p.biography ? (
            <p className="mt-3 whitespace-pre-wrap indent-6 text-[12px] leading-6 text-zinc-700">
              {p.biography}
            </p>
          ) : (
            <p className="mt-3 text-xs italic text-zinc-400">（暂无传略）</p>
          )}
        </div>
      </div>
    </div>
  ));
}

function baPage(book: AlbumBook) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <h2
        className="mb-6 text-2xl font-semibold tracking-widest text-zinc-900"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        跋
      </h2>
      <div className="max-w-md space-y-4 text-[13px] leading-7 text-zinc-700">
        <p className="indent-8">
          {book.family.name} 之续修，{book.totalPersons}{" "}
          人之名讳俱列，{book.volumes.length} 卷之事迹悉收。
          自来族谱，所以序昭穆、明亲疏、垂久远，
          俾后裔知所自出、敬其所宗。
        </p>
        <p className="indent-8">
          本谱以族谱·家系统编纂，凡有疏漏，留待续修补正。
        </p>
        <p
          className="mt-8 text-xs text-zinc-500"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {new Date(book.generatedAt).getFullYear()} 年{" "}
          {new Date(book.generatedAt).getMonth() + 1} 月
        </p>
      </div>
    </div>
  );
}

// ---------- 工具 ----------

function numToHan(n: number): string {
  const map = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (n <= 10) return map[n];
  if (n < 20) return "十" + map[n - 10];
  return String(n);
}

function roleLabel(role: string): string {
  switch (role) {
    case "OWNER":
      return "主修";
    case "ADMIN":
      return "协修";
    case "MEMBER":
      return "采访";
    default:
      return "助修";
  }
}
