"use client";
import { useMemo } from "react";
import type { LayoutIndex } from "@/lib/services/layout-index";

/**
 * inspector 内的小关系图：以当前人物为中心，向上 3 代父系直系祖先 + 直接子女。
 * 完全基于预构建的 LayoutIndex（O(1) 查询），不再扫描整棵 layout。
 */
export function MiniRelationGraph({
  personId,
  index,
  onJump,
}: {
  personId: string;
  index: LayoutIndex;
  onJump: (id: string) => void;
}) {
  const data = useMemo(() => {
    const { nodesById, fatherOf, childrenByFather } = index;

    // 上 3 代直系
    const ancestors: string[] = [];
    let cur: string | undefined = fatherOf.get(personId);
    for (let i = 0; i < 3 && cur; i++) {
      ancestors.push(cur);
      cur = fatherOf.get(cur);
    }

    // 下 1 代
    const childIds = childrenByFather.get(personId) ?? [];

    return {
      ancestors: ancestors.reverse(),
      childIds,
      nodesById,
    };
  }, [personId, index]);

  const focus = data.nodesById.get(personId)?.person;
  if (!focus) return null;

  return (
    <div className="rounded-md bg-zinc-50 p-2 dark:bg-zinc-800/40">
      {/* 上 3 代：垂直链 */}
      {data.ancestors.length > 0 && (
        <div className="mb-1 flex flex-col items-center gap-1">
          {data.ancestors.map((id) => {
            const p = data.nodesById.get(id)?.person;
            if (!p) return null;
            return (
              <div key={id} className="flex flex-col items-center">
                <Pill p={p} onJump={onJump} />
                <span className="my-0.5 h-2 w-px bg-zinc-300 dark:bg-zinc-600" />
              </div>
            );
          })}
        </div>
      )}

      {/* 中心 */}
      <div className="flex flex-col items-center">
        <Pill p={focus} variant="focus" onJump={onJump} />
      </div>

      {/* 下 1 代 */}
      {data.childIds.length > 0 && (
        <>
          <span className="mx-auto my-0.5 block h-2 w-px bg-zinc-300 dark:bg-zinc-600" />
          <div className="flex justify-center gap-1.5">
            {data.childIds.map((id) => {
              const p = data.nodesById.get(id)?.person;
              if (!p) return null;
              return <Pill key={id} p={p} onJump={onJump} />;
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Pill({
  p,
  variant,
  onJump,
}: {
  p: { id: string; name: string; gender: string };
  variant?: "focus";
  onJump: (id: string) => void;
}) {
  const base =
    p.gender === "MALE"
      ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
      : p.gender === "FEMALE"
        ? "bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-200"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800";
  const focusCls =
    variant === "focus"
      ? "ring-1 ring-amber-400 ring-offset-1 font-semibold"
      : "hover:opacity-80";
  return (
    <button
      type="button"
      onClick={() => onJump(p.id)}
      className={`rounded px-1.5 py-0.5 text-[11px] leading-tight transition ${base} ${focusCls}`}
      title={p.name}
    >
      {p.name}
    </button>
  );
}
