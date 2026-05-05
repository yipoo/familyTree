"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TreeCanvas } from "@/components/tree/TreeCanvas";
import { PersonInspector } from "@/components/tree/PersonInspector";
import { LineageTabs } from "@/components/LineageTabs";
import { TreeHeaderSearch } from "@/components/tree/TreeHeaderSearch";
import type { LayoutResult } from "@/lib/services/tree-layout";
import { buildLayoutIndex } from "@/lib/services/layout-index";

export type ResidenceMap = Record<
  string,
  { fullText: string; short: string; fromPersonId: string; inherited: boolean }
>;

interface GraphResponse {
  family: { id: string; name: string; surname: string };
  rootPersonId: string | null;
  rootPersonName: string;
  branchInfo: { name: string; rootName: string } | null;
  lineage: "paternal" | "maternal" | "all";
  focusPersonId: string | null;
  upGen: number | null;
  stats: { total: number; male: number; female: number };
  layout: LayoutResult | null;
  generationChars: Record<string, string>;
  residenceByPersonId: ResidenceMap;
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

  // 三态合一的 fetch state：避免在 effect 中同步 setLoading(true)
  const [state, setState] = useState<FetchState>(LOADING);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 折叠状态由 TreeView 持有，TreeCanvas 与 PersonInspector 共用——这样 inspector 也能
  // "在选中节点上直接点折叠"，且双击节点折叠后 inspector 立刻同步显示后代数。
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(EMPTY_SET);

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

  // 路由参数变化（不同 family / root / focus / lineage）→ 重置回 loading + 清空折叠：
  // 用 React 官方"render 内 track previous + 条件 setState"派生模式，避免 effect 中同步 setState。
  const requestKey = `${familyId}|${root}|${focus}|${lineage}`;
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
        const r = await fetch(`/api/families/${familyId}/graph?${sp}`, {
          signal: ctrl.signal,
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
  }, [familyId, root, focus, lineage, router]);

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
          <TreeHeaderSearch familyId={familyId} />
          <span className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
            {data && (
              <>
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
              </>
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
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
