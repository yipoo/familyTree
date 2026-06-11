"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TreeCanvas } from "@/components/tree/TreeCanvas";
import { PersonInspector } from "@/components/tree/PersonInspector";
import { LineageTabs } from "@/components/LineageTabs";
import { TreeHeaderSearch } from "@/components/tree/TreeHeaderSearch";
import { SpacingControl } from "@/components/tree/SpacingControl";
import {
  ScrollModeToggle,
  isScrollMode,
  type ScrollMode,
} from "@/components/tree/ScrollModeToggle";
import { FilterPanel } from "@/components/tree/FilterPanel";
import {
  isSpacingPreset,
  DEFAULT_SPACING,
  type LayoutResult,
  type SpacingPreset,
} from "@/lib/services/tree-layout";
import { buildLayoutIndex } from "@/lib/services/layout-index";
import {
  filterToQuery,
  isFilterEmpty,
  matchesFilter,
  parseFilterFromParams,
  type TreeFilter,
} from "@/lib/services/tree-filter";

export type ResidenceMap = Record<
  string,
  {
    locationId: string;
    fullText: string;
    short: string;
    fromPersonId: string;
    inherited: boolean;
  }
>;

interface GraphResponse {
  family: { id: string; name: string; surname: string };
  rootPersonId: string | null;
  rootPersonName: string;
  branchInfo: { name: string; rootName: string } | null;
  lineage: "paternal" | "maternal" | "all";
  mode?: "full" | "kin5";
  focusPersonId: string | null;
  upGen: number | null;
  stats: { total: number; male: number; female: number };
  layout: LayoutResult | null;
  generationChars: Record<string, string>;
  residenceByPersonId: ResidenceMap;
}

const SPACING_LS_KEY = (familyId: string) => `tree:spacing:${familyId}`;
const SCROLL_MODE_LS_KEY = "tree:scrollMode";

function readSpacingFromLS(familyId: string): SpacingPreset {
  if (typeof window === "undefined") return DEFAULT_SPACING;
  try {
    const v = window.localStorage.getItem(SPACING_LS_KEY(familyId));
    return isSpacingPreset(v) ? v : DEFAULT_SPACING;
  } catch {
    return DEFAULT_SPACING;
  }
}

function readScrollModeFromLS(): ScrollMode {
  if (typeof window === "undefined") return "zoom";
  try {
    const v = window.localStorage.getItem(SCROLL_MODE_LS_KEY);
    return isScrollMode(v) ? v : "zoom";
  } catch {
    return "zoom";
  }
}

type FetchState =
  | { kind: "loading" }
  | { kind: "loaded"; data: GraphResponse }
  | { kind: "error"; message: string };

const LOADING: FetchState = { kind: "loading" };

// 复用同一空 Set——保持 collapsedIds 在"全部展开"时引用稳定，避免下游 memo 假失效
const EMPTY_SET: Set<string> = new Set();

export function TreeView({
  familyId,
  familyName,
}: {
  familyId: string;
  familyName: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const root = params.get("root") ?? "";
  const focus = params.get("focus") ?? "";
  const lineage = params.get("lineage") ?? "all";
  const mode = params.get("mode") === "kin5" ? "kin5" : "full";

  // 三态合一的 fetch state：避免在 effect 中同步 setLoading(true)
  const [state, setState] = useState<FetchState>(LOADING);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 数据变更版本号：inspector 等子组件添加 / 修改 / 删除人物后调 onDataChanged()
  // 把它递增一次，下面的 fetch effect 把 dataRevision 列在依赖里，因此自动重拉 graph。
  const [dataRevision, setDataRevision] = useState(0);
  const handleDataChanged = useCallback(() => {
    setDataRevision((v) => v + 1);
  }, []);
  // 折叠状态由 TreeView 持有，TreeCanvas 与 PersonInspector 共用——这样 inspector 也能
  // "在选中节点上直接点折叠"，且双击节点折叠后 inspector 立刻同步显示后代数。
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(EMPTY_SET);

  // 间距档位：先 SSR 安全默认，挂载后从 localStorage 读取（避免 hydration mismatch）。
  // 使用"render 内 track previous + 条件 setState"派生模式，避免 effect 中同步 setState。
  const [spacing, setSpacing] = useState<SpacingPreset>(DEFAULT_SPACING);
  const [lsSpacingFamily, setLsSpacingFamily] = useState<string | null>(null);
  if (typeof window !== "undefined" && lsSpacingFamily !== familyId) {
    setLsSpacingFamily(familyId);
    setSpacing(readSpacingFromLS(familyId));
  }
  const handleSpacingChange = useCallback(
    (next: SpacingPreset) => {
      setSpacing(next);
      try {
        window.localStorage.setItem(SPACING_LS_KEY(familyId), next);
      } catch {
        // ignore
      }
    },
    [familyId],
  );

  // 滚轮模式：同样用 render 内派生模式
  const [scrollMode, setScrollMode] = useState<ScrollMode>("zoom");
  const [scrollLoaded, setScrollLoaded] = useState(false);
  if (typeof window !== "undefined" && !scrollLoaded) {
    setScrollLoaded(true);
    setScrollMode(readScrollModeFromLS());
  }
  const handleScrollModeChange = useCallback((next: ScrollMode) => {
    setScrollMode(next);
    try {
      window.localStorage.setItem(SCROLL_MODE_LS_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  // 筛选：URL 是真相
  const filter = useMemo<TreeFilter>(() => parseFilterFromParams(params), [params]);
  const handleFilterChange = useCallback(
    (next: TreeFilter) => {
      const sp = new URLSearchParams(params.toString());
      // 移除老的 filter 相关 keys
      for (const k of [
        "loc",
        "genChar",
        "genFrom",
        "genTo",
        "sex",
        "fstatus",
        "hideUnmatched",
      ]) {
        sp.delete(k);
      }
      // 写入新值
      const q = filterToQuery(next);
      for (const [k, v] of Object.entries(q)) sp.set(k, v);
      const queryStr = sp.toString();
      router.replace(
        `/f/${familyId}/tree${queryStr ? `?${queryStr}` : ""}`,
        { scroll: false },
      );
    },
    [params, router, familyId],
  );

  // 稳定回调，避免每次 render 产生新引用造成 TreeCanvas 内部 effect 重新触发
  const handleSelectChange = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const handleToggleCollapsed = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // selectedId 是 inspector 打开/关闭的唯一信号
  const inspectorOpen = !!selectedId;

  const data = state.kind === "loaded" ? state.data : null;
  const loading = state.kind === "loading";
  const error = state.kind === "error" ? state.message : null;

  // 把 data?.layout 提到本地 const——React Compiler 才能把 useMemo 的 inferred dep
  // 与手写的 [layout] 对齐；否则它推断成 data，与手写不匹配会跳过编译。
  const layout = data?.layout ?? null;
  const layoutIndex = useMemo(
    () => (layout ? buildLayoutIndex(layout) : null),
    [layout],
  );

  // collapseAll：把所有"有可见子女"的节点都加入 collapsedIds
  const handleCollapseAll = useCallback(() => {
    if (!layoutIndex) return;
    const all = new Set<string>();
    for (const id of layoutIndex.visibleChildrenOf.keys()) all.add(id);
    setCollapsedIds(all);
  }, [layoutIndex]);

  const handleExpandAll = useCallback(() => {
    setCollapsedIds(EMPTY_SET);
  }, []);

  // 路由参数变化（不同 family / root / focus / lineage / spacing）→ 重置回 loading + 清空折叠：
  // 用 React 官方"render 内 track previous + 条件 setState"派生模式，避免 effect 中同步 setState。
  const requestKey = `${familyId}|${root}|${focus}|${lineage}|${spacing}|${mode}`;
  const [lastRequestKey, setLastRequestKey] = useState(requestKey);
  if (lastRequestKey !== requestKey) {
    setLastRequestKey(requestKey);
    setState(LOADING);
    setCollapsedIds(EMPTY_SET);
  }

  // 数据拉取：effect 仅做 fetch + await + setState（await 之后 setState 不算 sync-in-effect）
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    (async () => {
      try {
        const sp = new URLSearchParams();
        if (focus) sp.set("focus", focus);
        else if (root) sp.set("root", root);
        // 默认 "all" 与 API 默认对齐——非默认才显式带参，URL 更短
        if (lineage !== "all") sp.set("lineage", lineage);
        if (spacing !== DEFAULT_SPACING) sp.set("spacing", spacing);
        if (mode === "kin5") sp.set("mode", "kin5");
        // dataRevision 进 URL —— 既绕开浏览器 HTTP 缓存，也方便排查 devtools 上看到的请求是哪一次
        if (dataRevision > 0) sp.set("_v", String(dataRevision));
        const r = await fetch(`/api/families/${familyId}/graph?${sp}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (cancelled) return;
        if (r.status === 401) {
          const next = encodeURIComponent(
            window.location.pathname + window.location.search,
          );
          router.replace(`/login?next=${next}`);
          return;
        }
        if (r.status === 403) {
          throw new Error(
            "无权访问该家族（请联系管理员或注册账号自动加入 demo 家族）",
          );
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as { data: GraphResponse };
        if (cancelled) return;
        setState({ kind: "loaded", data: json.data });
      } catch (e) {
        if (cancelled) return;
        if ((e as Error).name === "AbortError") return;
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [familyId, root, focus, lineage, spacing, mode, router, dataRevision]);

  // 计算当前可见集合中"不匹配筛选"的人物 id（dimmedIds）。
  // 注意：layout.nodes 已经按 lineage / focus / root 过滤过，所以"总数"取这里的长度。
  const dimmedInfo = useMemo<{ dimmed: Set<string>; matched: number; total: number }>(() => {
    if (!data?.layout) return { dimmed: new Set(), matched: 0, total: 0 };
    const total = data.layout.nodes.length;
    if (isFilterEmpty(filter)) return { dimmed: new Set(), matched: total, total };
    const dimmed = new Set<string>();
    let matched = 0;
    for (const n of data.layout.nodes) {
      const r = data.residenceByPersonId[n.id];
      const ok = matchesFilter(
        {
          id: n.id,
          generation: n.person.generation,
          generationChar: n.person.generationChar,
          gender: n.person.gender,
          status: n.person.status,
        },
        // 用解析后的 location id 与筛选条件匹配（沿父系上溯继承的也算）
        r?.locationId ?? null,
        filter,
      );
      if (ok) matched += 1;
      else dimmed.add(n.id);
    }
    return { dimmed, matched, total };
  }, [data, filter]);

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="shrink-0 border-b border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href={`/f/${familyId}`}
            className="text-sm text-zinc-500 hover:underline"
          >
            ←
          </Link>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {familyName} · 树谱
          </h1>
          {data?.branchInfo && !root && !focus && (
            <span className="text-xs text-zinc-500">
              {data.branchInfo.name}（根：{data.branchInfo.rootName}）
            </span>
          )}
          {focus && data?.focusPersonId && (
            <span className="text-xs text-blue-700 dark:text-blue-400">
              聚焦 · 上 {data.upGen} 代 + 全部后代
              <Link
                href={`/f/${familyId}/tree${
                  lineage !== "all" ? `?lineage=${lineage}` : ""
                }`}
                className="ml-2 underline"
              >
                展开所有分支
              </Link>
            </span>
          )}
          {root && !focus && data?.rootPersonName && (
            <span className="text-xs text-blue-700 dark:text-blue-400">
              仅看分支 · {data.rootPersonName}
              <Link
                href={`/f/${familyId}/tree${
                  lineage !== "all" ? `?lineage=${lineage}` : ""
                }`}
                className="ml-2 underline"
              >
                展开所有分支
              </Link>
            </span>
          )}
          <LineageTabs />
          {root && (
            <Link
              href={`/f/${familyId}/tree?root=${root}${
                mode === "kin5" ? "" : "&mode=kin5"
              }${lineage !== "all" ? `&lineage=${lineage}` : ""}`}
              prefetch={false}
              className={`rounded-md border px-2 py-1 text-xs transition ${
                mode === "kin5"
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
              title={
                mode === "kin5"
                  ? "近亲视图：±2 代直系 + 兄弟 + 配偶 + 侄甥。点击切换回完整视图"
                  : "近亲视图：以选中分支根为中心展示 5 代核心关系"
              }
            >
              {mode === "kin5" ? "完整视图" : "近亲视图"}
            </Link>
          )}
          <TreeHeaderSearch familyId={familyId} />
          <FilterPanel
            familyId={familyId}
            filter={filter}
            onChange={handleFilterChange}
            matchedCount={dimmedInfo.matched}
            totalCount={dimmedInfo.total}
          />
          <span className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
            <SpacingControl value={spacing} onChange={handleSpacingChange} />
            <ScrollModeToggle value={scrollMode} onChange={handleScrollModeChange} />
            {/* 小屏隐藏统计数字（避免顶栏溢出），≥sm 才显示 */}
            {data && (
              <span className="hidden items-center gap-3 sm:flex">
                <span>
                  人数{" "}
                  <strong className="text-zinc-900 dark:text-zinc-50">
                    {data.stats.total}
                  </strong>
                </span>
                <span>
                  男 <strong className="text-blue-600">{data.stats.male}</strong>
                </span>
                <span>
                  女 <strong className="text-pink-600">{data.stats.female}</strong>
                </span>
              </span>
            )}
            {loading && <span className="animate-pulse">加载中…</span>}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：树谱画布 */}
        <div className="relative flex-1">
          {error ? (
            <div className="flex h-full items-center justify-center text-sm text-red-600">
              加载失败：{error}
            </div>
          ) : !data ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
                <div>正在加载树谱数据…</div>
              </div>
            </div>
          ) : !data.layout || !layoutIndex ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              无可显示数据（请尝试切换谱系或清除聚焦）
            </div>
          ) : (
            <TreeCanvas
              layout={data.layout}
              layoutIndex={layoutIndex}
              generationChars={Object.fromEntries(
                Object.entries(data.generationChars).map(([k, v]) => [Number(k), v]),
              )}
              focusPersonId={data.focusPersonId}
              selectedId={selectedId}
              onSelectChange={handleSelectChange}
              residenceByPersonId={data.residenceByPersonId}
              collapsedIds={collapsedIds}
              onToggleCollapsed={handleToggleCollapsed}
              onCollapseAll={handleCollapseAll}
              onExpandAll={handleExpandAll}
              dimmedIds={dimmedInfo.dimmed}
              hideUnmatched={filter.hideUnmatched}
              scrollMode={scrollMode}
              spacingAnimToken={spacing}
            />
          )}

        </div>

        {/* 右侧：仅当选中节点时才显示 inspector（桌面） */}
        <div
          className={`hidden shrink-0 transition-[width] duration-200 lg:flex ${
            inspectorOpen ? "w-96" : "w-0"
          }`}
        >
          {data?.layout && inspectorOpen && (
            <PersonInspector
              familyId={familyId}
              personId={selectedId}
              layoutIndex={layoutIndex}
              residenceByPersonId={data.residenceByPersonId}
              onClearSelection={() => setSelectedId(null)}
              collapsedIds={collapsedIds}
              onToggleCollapsed={handleToggleCollapsed}
              onDataChanged={handleDataChanged}
            />
          )}
        </div>

        {/* 手机端：选中节点时弹出底部抽屉 */}
        {inspectorOpen && data?.layout && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
              onClick={() => setSelectedId(null)}
            />
            <div className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900 lg:hidden">
              <PersonInspector
                familyId={familyId}
                personId={selectedId}
                layoutIndex={layoutIndex}
                residenceByPersonId={data.residenceByPersonId}
                onClearSelection={() => setSelectedId(null)}
                collapsedIds={collapsedIds}
                onToggleCollapsed={handleToggleCollapsed}
                onDataChanged={handleDataChanged}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
