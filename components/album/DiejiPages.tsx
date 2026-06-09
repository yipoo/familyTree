/**
 * 牒记式（行传式）—— 纯文字传记。
 *
 * 经典格式：
 *   "××公，行第×，字××，号××。生于××，卒于××，享年××。
 *    配××氏，子×：××、××；女×。葬于××。"
 *
 * 分页策略：
 *   - 封面 1 页
 *   - 序 / 字辈表 1 页（如有）
 *   - 每卷扉页 1 页
 *   - 每章按每页 6 条目分页
 *   - 跋 1 页
 */
import type { AlbumBook } from "@/lib/services/album";
import { formatPersonEntryText } from "@/lib/services/album";
import { offsetIndex, type AlbumBuild, type AlbumIndexEntry } from "./album-index";

const ENTRIES_PER_PAGE = 6;

export function buildDiejiiPages(book: AlbumBook): AlbumBuild {
  const pages: React.ReactNode[] = [];
  const index: AlbumIndexEntry[] = [];

  // 封面
  pages.push(
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-xs tracking-[0.3em] text-zinc-500">
        {book.family.surname} 氏 · 牒记式
      </p>
      <h1
        className="mt-6 text-3xl font-semibold tracking-[0.2em] text-zinc-900 sm:text-4xl"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {book.family.name}
      </h1>
      {book.family.founderName && (
        <p className="mt-3 text-sm text-zinc-600">
          始祖 · {book.family.founderName}
        </p>
      )}
      <p className="mt-12 text-[11px] text-zinc-400">
        生成于 {new Date(book.generatedAt).toLocaleDateString("zh-CN")}
      </p>
      <p className="mt-1 text-[11px] text-zinc-400">
        共 {book.totalPersons} 人 · {book.volumes.length} 卷
      </p>
    </div>,
  );

  // 序
  if (book.family.description || book.generationNames.length > 0) {
    pages.push(
      <div className="flex h-full flex-col">
        <h2
          className="mb-4 border-b border-zinc-300 pb-2 text-center text-2xl font-semibold tracking-widest text-zinc-900"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          序
        </h2>
        {book.family.description && (
          <p className="mb-6 whitespace-pre-wrap text-sm leading-7 text-zinc-800 indent-8">
            {book.family.description}
          </p>
        )}
        {book.generationNames.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-700">字辈表</h3>
            <div className="flex flex-wrap gap-1.5">
              {book.generationNames.map((g) => (
                <span
                  key={g.generation}
                  className="inline-flex flex-col items-center rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
                >
                  <span className="text-[10px] text-zinc-500">{g.generation} 世</span>
                  <span
                    className="text-base font-semibold text-zinc-900"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {g.character}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>,
    );
  }

  // 各卷正文（含卷扉页 + 章节）
  const body = buildDiejiiBody(book);
  const bodyOffset = pages.length;
  pages.push(...body.pages);
  index.push(...offsetIndex(body.index, bodyOffset));

  // 跋
  pages.push(
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="text-xs italic text-zinc-500">
        ——本册谱由族谱·家系统自动生成——
      </div>
      <p className="mt-3 text-[11px] text-zinc-400">
        共 {book.totalPersons} 位族人 · {book.volumes.length} 卷
      </p>
    </div>,
  );

  return { pages, index };
}

/**
 * 仅生成牒记式"卷正文"页（不含封面 / 序 / 跋）+ 页内人物索引（相对页码）。
 */
export function buildDiejiiBody(book: AlbumBook): AlbumBuild {
  const pages: React.ReactNode[] = [];
  const index: AlbumIndexEntry[] = [];
  book.volumes.forEach((vol, vi) => {
    // 卷扉页
    pages.push(
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-xs tracking-widest text-zinc-500">
          卷之{["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][vi] ?? vi + 1}
        </p>
        <h2
          className="mt-4 text-2xl font-semibold tracking-widest text-zinc-900"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {vol.branchName}
        </h2>
        <p className="mt-6 text-sm text-zinc-500">收录 {vol.count} 人</p>
      </div>,
    );

    for (const ch of vol.chapters) {
      for (let p = 0; p < ch.entries.length; p += ENTRIES_PER_PAGE) {
        const slice = ch.entries.slice(p, p + ENTRIES_PER_PAGE);
        const pageIdx = pages.length;
        const isFirstSlice = p === 0;
        const isContinued = p > 0;
        pages.push(
          <div className="flex h-full flex-col">
            {isFirstSlice && (
              <h3
                className="mb-3 border-b border-zinc-300 pb-1 text-base font-medium text-zinc-900"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                第 {ch.generation} 世
                {ch.generationChar && ` · ${ch.generationChar}`}
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  共 {ch.entries.length} 人
                </span>
              </h3>
            )}
            {isContinued && (
              <p className="mb-3 text-xs text-zinc-500">
                第 {ch.generation} 世（接前页）
              </p>
            )}
            <ol className="flex-1 space-y-3">
              {slice.map((e, ei) => (
                <li
                  key={e.id}
                  className="text-[13px] leading-7 text-zinc-800"
                  style={{ textIndent: "2em" }}
                >
                  <span className="mr-1 text-[11px] text-zinc-400">
                    {p + ei + 1}.
                  </span>
                  {formatPersonEntryText(e)}
                </li>
              ))}
            </ol>
          </div>,
        );
        for (const e of slice) {
          index.push({
            name: e.name,
            alias: e.alias,
            generation: e.generation,
            page: pageIdx,
          });
        }
      }
    }
  });
  return { pages, index };
}
