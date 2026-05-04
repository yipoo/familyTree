"use client";
import { useViewport } from "@xyflow/react";
import { TREE_LAYOUT_CONSTS } from "@/lib/services/tree-layout";

const { NODE_H } = TREE_LAYOUT_CONSTS;

export interface GenerationRow {
  generation: number;
  layoutY: number; // 节点的 layoutY（节点顶部）
  char: string | null;
}

/**
 * 左侧固定世代轴：水平不随平移变化（始终贴左边），垂直跟随 ReactFlow 的 viewport 平移和缩放。
 * 必须放在 ReactFlow 内部以使用 useViewport()。
 */
export function GenerationAxis({ rows }: { rows: GenerationRow[] }) {
  const { x: _vx, y: vy, zoom } = useViewport();
  void _vx;

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 sm:w-16">
      {/* 半透明背景遮挡节点穿过 */}
      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-transparent dark:from-zinc-950 dark:via-zinc-950/95" />

      {/* 顶部标题 */}
      <div className="absolute left-0 top-0 px-2 py-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
        世代
      </div>

      {/* 各代标签 */}
      {rows.map((r) => {
        // 节点中心的 layoutY
        const centerLayoutY = r.layoutY + NODE_H / 2;
        const screenY = centerLayoutY * zoom + vy;
        return (
          <div
            key={r.generation}
            className="absolute left-0 right-1 flex flex-col items-center justify-center text-center"
            style={{ top: screenY, transform: "translateY(-50%)" }}
          >
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {r.generation}
              <span className="ml-0.5 text-[10px] font-normal text-zinc-500">世</span>
            </div>
            {r.char && (
              <div className="mt-0.5 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {r.char}
              </div>
            )}
          </div>
        );
      })}

      {/* 右侧分隔线 */}
      <div className="absolute right-0 top-0 h-full w-px bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
