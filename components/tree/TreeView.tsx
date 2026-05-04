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
  const lineage = params.get("lineage") ?? "paternal";

  const [data, setData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 稳定回调，避免每次 render 产生新引用造成 TreeCanvas 内部 effect 重新触发
  const handleSelectChange = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  // selectedId 是 inspector 打开/关闭的唯一信号
  const inspectorOpen = !!selectedId;

  // 关系索引：layout 变化时构建一次，inspector / 关系图 O(1) 查询
  const layoutIndex = useMemo(
    () => (data?.layout ? buildLayoutIndex(data.layout) : null),
    [data?.layout],
  );

  useEffect(() => {
    let abort = false;
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams();
    if (focus) sp.set("focus", focus);
    else if (root) sp.set("root", root);
    if (lineage !== "paternal") sp.set("lineage", lineage);
    fetch(`/api/families/${familyId}/graph?${sp}`)
      .then(async (r) => {
        if (r.status === 401) {
          // 未登录 → 跳到登录页，登录完成后回到当前 URL
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          router.replace(`/login?next=${next}`);
          return;
        }
        if (r.status === 403) {
          throw new Error("无权访问该家族（请联系管理员或注册账号自动加入 demo 家族）");
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as { data: GraphResponse };
        if (!abort) setData(json.data);
      })
      .catch((e) => {
        if (!abort) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!abort) setLoading(false);
      });
    return () => {
      abort = true;
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
                  lineage !== "paternal" ? `?lineage=${lineage}` : ""
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
                  lineage !== "paternal" ? `?lineage=${lineage}` : ""
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
          ) : !data.layout ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              无可显示数据（请尝试切换谱系或清除聚焦）
            </div>
          ) : (
            <TreeCanvas
              layout={data.layout}
              generationChars={Object.fromEntries(
                Object.entries(data.generationChars).map(([k, v]) => [Number(k), v]),
              )}
              focusPersonId={data.focusPersonId}
              selectedId={selectedId}
              onSelectChange={handleSelectChange}
              residenceByPersonId={data.residenceByPersonId}
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
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
