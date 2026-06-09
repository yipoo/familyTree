"use client";

/**
 * 书本翻页查看器
 *
 * 对开两页（移动端单页），左右键 / Space 翻页，点击左右半区翻页。
 * 翻页用 horizontal slide 过渡——简单、跨浏览器稳定，省去 3D flip 边角处理。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AlbumIndexEntry } from "./album-index";

interface Props {
  pages: React.ReactNode[];
  /** 书本标题（在外层显示） */
  bookTitle?: string;
  /** 跳页指示文案，默认 "X / Y" */
  className?: string;
  /** 人物索引：搜索后定位到具体页 */
  index?: AlbumIndexEntry[];
}

const ANIM_MS = 380;

export function BookViewer({ pages, bookTitle, className, index }: Props) {
  // 双页对开：spread 0 = pages[0..1]，spread 1 = pages[2..3]，以此类推
  // 在小屏幕上回退为单页（每个 spread 一页）
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 767px)");
    setIsMobile(m.matches);
    const fn = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    m.addEventListener("change", fn);
    return () => m.removeEventListener("change", fn);
  }, []);

  const pagesPerSpread = isMobile ? 1 : 2;
  const spreadCount = Math.max(1, Math.ceil(pages.length / pagesPerSpread));
  const [spread, setSpread] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev" | null>(null);
  const animTimer = useRef<number | null>(null);

  // 搜索定位
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const flip = useCallback(
    (dir: "next" | "prev") => {
      setSpread((curr) => {
        const next = dir === "next" ? curr + 1 : curr - 1;
        if (next < 0 || next >= spreadCount) return curr;
        setDirection(dir);
        if (animTimer.current) window.clearTimeout(animTimer.current);
        animTimer.current = window.setTimeout(() => {
          setDirection(null);
        }, ANIM_MS);
        return next;
      });
    },
    [spreadCount],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.code === "Space") {
        e.preventDefault();
        flip("next");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        flip("prev");
      } else if (e.key === "Home") {
        setSpread(0);
      } else if (e.key === "End") {
        setSpread(spreadCount - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip, spreadCount]);

  // 跳到指定页（0-based）所在对开
  const goToPage = useCallback(
    (page: number) => {
      const sp = Math.min(Math.max(0, Math.floor(page / pagesPerSpread)), spreadCount - 1);
      setSpread(sp);
      setDirection(null);
    },
    [pagesPerSpread, spreadCount],
  );

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term || !index) return [];
    const out = index.filter(
      (e) => e.name.toLowerCase().includes(term) || !!e.alias?.toLowerCase().includes(term),
    );
    out.sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name, "zh"));
    return out.slice(0, 50);
  }, [query, index]);

  useEffect(() => {
    if (!searchOpen) return;
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [searchOpen]);

  // 渲染当前 spread + 上一/下一 spread（只让相邻的存在以便平滑过渡）
  const visibleSpreads = useMemo(() => {
    const list: { index: number; pages: React.ReactNode[] }[] = [];
    for (let i = Math.max(0, spread - 1); i <= Math.min(spreadCount - 1, spread + 1); i++) {
      const start = i * pagesPerSpread;
      list.push({ index: i, pages: pages.slice(start, start + pagesPerSpread) });
    }
    return list;
  }, [spread, spreadCount, pagesPerSpread, pages]);

  const startPageNum = spread * pagesPerSpread + 1;
  const endPageNum = Math.min(pages.length, (spread + 1) * pagesPerSpread);

  return (
    <div
      className={`flex flex-col ${className ?? ""}`}
      role="document"
      aria-label={bookTitle ?? "册谱"}
    >
      {/* 搜索定位：输入人名 → 跳到其所在页 */}
      {index && index.length > 0 && (
        <div ref={searchRef} className="relative z-30 mb-3 w-full max-w-md print:hidden">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder={`搜索人物，定位到页（共收录 ${index.length} 条）`}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
          />
          {searchOpen && query.trim() && (
            <ul className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-panel py-1 text-sm shadow-lg">
              {matches.length === 0 ? (
                <li className="px-3 py-2 text-fg-muted">未找到「{query.trim()}」</li>
              ) : (
                matches.map((m, i) => (
                  <li key={`${m.name}-${m.page}-${i}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        goToPage(m.page);
                        setSearchOpen(false);
                      }}
                      className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-foreground hover:bg-muted"
                    >
                      <span className="truncate">
                        <span className="font-medium">{m.name}</span>
                        {m.alias ? <span className="text-fg-muted">（{m.alias}）</span> : null}
                        <span className="ml-1.5 text-xs text-fg-subtle">{m.generation} 世</span>
                      </span>
                      <span className="shrink-0 text-xs text-brand">第 {m.page + 1} 页</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      {/* 打印态：每页一张物理页，page-break-after 让浏览器分页 */}
      <div className="hidden print:block w-full">
        {pages.map((p, i) => (
          <section
            key={i}
            className="album-print-page bg-white px-12 py-10 text-zinc-900"
            style={{
              minHeight: "85vh",
              pageBreakAfter: "always",
              breakAfter: "page",
            }}
          >
            {p}
            <p className="mt-6 text-center text-[10px] text-zinc-400">
              {i + 1} / {pages.length}
            </p>
          </section>
        ))}
      </div>

      {/* 翻页主区（屏幕态）——宽度撑满容器，与页头对齐 */}
      <div className="relative w-full print:hidden">
        {/* 书脊 + 阴影背板 */}
        <div className="relative mx-auto aspect-[10/7] w-full overflow-hidden rounded-md bg-gradient-to-b from-amber-50 to-amber-100 shadow-2xl ring-1 ring-amber-900/10 dark:from-zinc-800 dark:to-zinc-900 dark:ring-zinc-700/50 sm:aspect-[14/9]">
          {/* 中线（书脊） */}
          {!isMobile && (
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-amber-900/15 dark:bg-zinc-600/40" />
          )}
          {/* 书页 */}
          {visibleSpreads.map((s) => {
            // 离当前 spread 的偏移：-1=上一页（左侧滑出）、0=当前、1=下一页（右侧滑出）
            const offset = s.index - spread;
            const animating = direction !== null && Math.abs(offset) <= 1;
            const transform =
              offset === 0
                ? "translateX(0%)"
                : offset === 1
                  ? "translateX(100%)"
                  : "translateX(-100%)";
            return (
              <div
                key={s.index}
                aria-hidden={offset !== 0}
                className="absolute inset-0 flex"
                style={{
                  transform,
                  transition: animating
                    ? `transform ${ANIM_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
                    : "none",
                  pointerEvents: offset === 0 ? "auto" : "none",
                }}
              >
                {s.pages.map((p, i) => {
                  const pageIndex = s.index * pagesPerSpread + i;
                  const totalPages = pages.length;
                  return (
                    <article
                      key={pageIndex}
                      // 强制书页内文字始终为深色，避免被 dark 模式的 body fg 继承覆盖。
                      // 书页本身在两种模式下都是浅米色 / 浅灰，深色文字保证印刷质感。
                      className={`relative flex h-full ${
                        isMobile ? "w-full" : "w-1/2"
                      } flex-col bg-[#fdfaf2] text-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 ${
                        i === 0 && !isMobile
                          ? "rounded-l-md shadow-[inset_-12px_0_24px_-12px_rgba(0,0,0,0.18)]"
                          : !isMobile
                            ? "rounded-r-md shadow-[inset_12px_0_24px_-12px_rgba(0,0,0,0.18)]"
                            : "rounded-md"
                      }`}
                    >
                      <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-8">
                        {p}
                      </div>
                      <footer className="px-6 py-2 text-center text-[10px] text-zinc-500 sm:px-10">
                        {pageIndex + 1} / {totalPages}
                      </footer>
                    </article>
                  );
                })}
                {/* 末页奇数补白 */}
                {s.pages.length === 1 && !isMobile && (
                  <div className="h-full w-1/2 rounded-r-md bg-[#fdfaf2] dark:bg-zinc-100 shadow-[inset_12px_0_24px_-12px_rgba(0,0,0,0.18)]" />
                )}
              </div>
            );
          })}

          {/* 点击左右半区翻页 */}
          <button
            type="button"
            aria-label="上一页"
            onClick={() => flip("prev")}
            disabled={spread === 0}
            className="absolute inset-y-0 left-0 z-20 w-1/4 cursor-w-resize opacity-0 transition hover:opacity-10 disabled:cursor-default"
            style={{ background: "linear-gradient(to right, rgba(0,0,0,0.4), transparent)" }}
          />
          <button
            type="button"
            aria-label="下一页"
            onClick={() => flip("next")}
            disabled={spread >= spreadCount - 1}
            className="absolute inset-y-0 right-0 z-20 w-1/4 cursor-e-resize opacity-0 transition hover:opacity-10 disabled:cursor-default"
            style={{ background: "linear-gradient(to left, rgba(0,0,0,0.4), transparent)" }}
          />
        </div>
      </div>

      {/* 工具栏：上一页 / 页码 / 下一页 + 跳转 */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => flip("prev")}
          disabled={spread === 0}
          className="rounded-md border border-border bg-panel px-3 py-1.5 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← 上一页
        </button>
        <span className="text-xs tabular-nums text-fg-muted">
          {startPageNum === endPageNum
            ? `第 ${startPageNum} 页`
            : `第 ${startPageNum}–${endPageNum} 页`}{" "}
          / 共 {pages.length} 页
        </span>
        <button
          type="button"
          onClick={() => flip("next")}
          disabled={spread >= spreadCount - 1}
          className="rounded-md border border-border bg-panel px-3 py-1.5 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          下一页 →
        </button>
        <span className="hidden text-[11px] text-fg-subtle sm:inline">
          ←/→ 翻页 · Space 下一页 · Home/End 跳到首/末
        </span>
      </div>
    </div>
  );
}
