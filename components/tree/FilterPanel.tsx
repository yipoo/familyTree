"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_FILTER,
  activeFilterCount,
  type TreeFilter,
  type SexFilter,
  type StatusFilter,
} from "@/lib/services/tree-filter";

interface LocationOption {
  id: string;
  label: string;
  fullText: string;
  province: string | null;
  city: string | null;
  county: string | null;
  count: number;
}

interface GenerationCharOption {
  generation: number;
  character: string;
}

interface FilterOptions {
  locations: LocationOption[];
  generationChars: GenerationCharOption[];
  generationRange: { min: number; max: number };
}

interface FilterPanelProps {
  familyId: string;
  filter: TreeFilter;
  onChange: (next: TreeFilter) => void;
  /** 筛选后的可见人数（已淡出/隐藏后还匹配的） */
  matchedCount: number;
  /** 可见集合总数 */
  totalCount: number;
}

export function FilterPanel({
  familyId,
  filter,
  onChange,
  matchedCount,
  totalCount,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locQuery, setLocQuery] = useState("");
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const fetchedRef = useRef(false);

  // 选项懒加载：在用户首次打开 popover 时触发（事件处理而非 effect，避免 set-state-in-effect）
  const ensureOptionsLoaded = useCallback(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    setError(null);
    fetch(`/api/families/${familyId}/tree-filters/options`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        setOptions(j.data as FilterOptions);
      })
      .catch((e) => {
        // 失败时允许下次打开重试
        fetchedRef.current = false;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, [familyId]);

  const togglePopover = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      if (next) ensureOptionsLoaded();
      return next;
    });
  }, [ensureOptionsLoaded]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!popoverRef.current) return;
      if (popoverRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const activeN = activeFilterCount(filter);

  const filteredLocations = useMemo(() => {
    if (!options) return [];
    const q = locQuery.trim();
    if (!q) return options.locations;
    return options.locations.filter(
      (l) =>
        l.label.includes(q) ||
        l.fullText.includes(q) ||
        (l.city ?? "").includes(q) ||
        (l.county ?? "").includes(q) ||
        (l.province ?? "").includes(q),
    );
  }, [options, locQuery]);

  function toggleInList<T>(list: T[], v: T): T[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={togglePopover}
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
          activeN > 0
            ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200"
            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        }`}
      >
        <span aria-hidden>⚙</span>
        <span>筛选</span>
        {activeN > 0 && (
          <span className="ml-1 rounded-full bg-blue-600 px-1.5 text-[10px] leading-4 text-white">
            {activeN}
          </span>
        )}
      </button>

      {/* 当前匹配数 chip（始终可见，用户能直接看到生效情况） */}
      {activeN > 0 && (
        <span className="ml-2 inline-flex items-center gap-2 rounded-md bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          已筛选 <strong className="text-zinc-900 dark:text-zinc-50">{matchedCount}</strong> /{" "}
          {totalCount}
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTER)}
            className="ml-1 text-blue-600 hover:underline"
          >
            清空
          </button>
        </span>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="筛选条件"
          className="absolute left-0 top-full z-30 mt-1 w-[min(92vw,460px)] origin-top-left rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          {loading && (
            <div className="py-4 text-center text-xs text-zinc-500">加载选项中…</div>
          )}
          {error && (
            <div className="py-4 text-center text-xs text-red-600">
              加载失败：{error}
            </div>
          )}
          {options && (
            <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
              {/* 地理位置 */}
              <section>
                <header className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  <span>居住地</span>
                  {filter.locationIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onChange({ ...filter, locationIds: [] })}
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      清除
                    </button>
                  )}
                </header>
                <input
                  type="search"
                  value={locQuery}
                  onChange={(e) => setLocQuery(e.target.value)}
                  placeholder={`搜索地名（共 ${options.locations.length} 个）`}
                  className="mb-1 w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                />
                <div className="max-h-40 overflow-y-auto rounded border border-zinc-100 dark:border-zinc-800">
                  {filteredLocations.slice(0, 200).map((l) => {
                    const active = filter.locationIds.includes(l.id);
                    return (
                      <label
                        key={l.id}
                        className={`flex cursor-pointer items-center gap-2 px-2 py-1 text-xs ${
                          active
                            ? "bg-blue-50 dark:bg-blue-950/40"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() =>
                            onChange({
                              ...filter,
                              locationIds: toggleInList(filter.locationIds, l.id),
                            })
                          }
                          className="h-3 w-3"
                        />
                        <span className="flex-1 truncate" title={l.fullText}>
                          {l.label}
                          {l.label !== l.fullText && (
                            <span className="ml-1 text-zinc-400">
                              · {l.fullText.replace(l.label, "").trim() || l.fullText}
                            </span>
                          )}
                        </span>
                        <span className="text-zinc-400">{l.count}</span>
                      </label>
                    );
                  })}
                  {filteredLocations.length === 0 && (
                    <div className="px-2 py-3 text-center text-xs text-zinc-400">
                      无匹配地点
                    </div>
                  )}
                </div>
              </section>

              {/* 字辈 */}
              {options.generationChars.length > 0 && (
                <section>
                  <header className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    <span>字辈</span>
                    {filter.generationChars.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          onChange({ ...filter, generationChars: [] })
                        }
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        清除
                      </button>
                    )}
                  </header>
                  <div className="flex flex-wrap gap-1">
                    {options.generationChars.map((g) => {
                      const active = filter.generationChars.includes(g.character);
                      return (
                        <button
                          key={g.generation}
                          type="button"
                          onClick={() =>
                            onChange({
                              ...filter,
                              generationChars: toggleInList(
                                filter.generationChars,
                                g.character,
                              ),
                            })
                          }
                          className={`rounded border px-2 py-0.5 text-xs ${
                            active
                              ? "border-blue-500 bg-blue-600 text-white"
                              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          }`}
                          title={`第 ${g.generation} 代`}
                        >
                          {g.character}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 世代范围 */}
              <section>
                <header className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  <span>
                    世代范围（{options.generationRange.min}–
                    {options.generationRange.max}）
                  </span>
                  {(filter.genFrom !== null || filter.genTo !== null) && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange({ ...filter, genFrom: null, genTo: null })
                      }
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      清除
                    </button>
                  )}
                </header>
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="number"
                    placeholder={String(options.generationRange.min)}
                    value={filter.genFrom ?? ""}
                    min={options.generationRange.min}
                    max={options.generationRange.max}
                    onChange={(e) => {
                      const v = e.target.value;
                      onChange({
                        ...filter,
                        genFrom: v === "" ? null : Number(v),
                      });
                    }}
                    className="w-20 rounded border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <span className="text-zinc-400">至</span>
                  <input
                    type="number"
                    placeholder={String(options.generationRange.max)}
                    value={filter.genTo ?? ""}
                    min={options.generationRange.min}
                    max={options.generationRange.max}
                    onChange={(e) => {
                      const v = e.target.value;
                      onChange({
                        ...filter,
                        genTo: v === "" ? null : Number(v),
                      });
                    }}
                    className="w-20 rounded border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
              </section>

              {/* 性别 */}
              <section className="flex items-center gap-3">
                <span className="w-12 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  性别
                </span>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { v: "MALE", label: "男" },
                      { v: "FEMALE", label: "女" },
                      { v: "UNKNOWN", label: "未知" },
                    ] as Array<{ v: SexFilter; label: string }>
                  ).map((o) => {
                    const active = filter.sexes.includes(o.v);
                    return (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() =>
                          onChange({
                            ...filter,
                            sexes: toggleInList(filter.sexes, o.v),
                          })
                        }
                        className={`rounded border px-2 py-0.5 text-xs ${
                          active
                            ? "border-blue-500 bg-blue-600 text-white"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 状态 */}
              <section className="flex items-center gap-3">
                <span className="w-12 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  状态
                </span>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { v: "ALIVE", label: "在世" },
                      { v: "DECEASED", label: "已故" },
                    ] as Array<{ v: StatusFilter; label: string }>
                  ).map((o) => {
                    const active = filter.statuses.includes(o.v);
                    return (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() =>
                          onChange({
                            ...filter,
                            statuses: toggleInList(filter.statuses, o.v),
                          })
                        }
                        className={`rounded border px-2 py-0.5 text-xs ${
                          active
                            ? "border-blue-500 bg-blue-600 text-white"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 隐藏不匹配开关 */}
              <section className="flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={filter.hideUnmatched}
                    onChange={(e) =>
                      onChange({ ...filter, hideUnmatched: e.target.checked })
                    }
                    className="h-3 w-3"
                  />
                  <span>隐藏不匹配（默认仅淡出，保留血脉脉络）</span>
                </label>
                {activeN > 0 && (
                  <button
                    type="button"
                    onClick={() => onChange(EMPTY_FILTER)}
                    className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    全部清空
                  </button>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
