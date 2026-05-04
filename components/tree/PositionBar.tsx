"use client";
import { useEffect, useRef, useState } from "react";
import { useReactFlow, useViewport, useStore } from "@xyflow/react";

/**
 * 顶部位置条：显示当前视口在整张树中的水平位置；可拖动定位。
 *
 *  整条 = 树的全宽
 *  滑块 = 当前视口可见范围
 *  支持：
 *    - 拖动滑块（按下并拖动）
 *    - 单击轨道某处 → 视口跳到该处
 */
export function PositionBar({
  worldWidth,
  worldHeight,
}: {
  worldWidth: number;
  worldHeight: number;
}) {
  const { x: vx, y: vy, zoom } = useViewport();
  const rf = useReactFlow();
  // 视口的实际 DOM 尺寸
  const screenW = useStore((s) => s.width);
  const screenH = useStore((s) => s.height);

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"x" | "y" | null>(null);

  // 当前可视世界范围（仅横向参与 UI；垂直滚动条暂未实现）
  const worldLeft = -vx / zoom;
  const visibleW = screenW / zoom;
  const visibleH = screenH / zoom;

  // 横向比例
  const hThumbLeftPct = clamp(worldLeft / worldWidth, 0, 1);
  const hThumbWidthPct = clamp(visibleW / worldWidth, 0.02, 1);

  function jumpToWorldX(targetWorldLeft: number) {
    const x = -targetWorldLeft * zoom;
    rf.setViewport({ x, y: vy, zoom });
  }
  function jumpToWorldY(targetWorldTop: number) {
    const y = -targetWorldTop * zoom;
    rf.setViewport({ x: vx, y, zoom });
  }

  // 横向拖拽 / 单击
  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      if (dragging === "x") {
        const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        // 让点击位置成为视口中心
        const target = ratio * worldWidth - visibleW / 2;
        jumpToWorldX(clamp(target, 0, Math.max(0, worldWidth - visibleW)));
      } else {
        const ratio = clamp((e.clientY - rect.top) / rect.height, 0, 1);
        const target = ratio * worldHeight - visibleH / 2;
        jumpToWorldY(clamp(target, 0, Math.max(0, worldHeight - visibleH)));
      }
    }
    function onUp() {
      setDragging(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, worldWidth, worldHeight, visibleW, visibleH, vx, vy, zoom]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-2 pt-2 sm:px-3">
      {/* 横向位置条 */}
      <div
        ref={trackRef}
        onMouseDown={(e) => {
          if (!trackRef.current) return;
          const rect = trackRef.current.getBoundingClientRect();
          const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
          const target = ratio * worldWidth - visibleW / 2;
          jumpToWorldX(clamp(target, 0, Math.max(0, worldWidth - visibleW)));
          setDragging("x");
        }}
        className="pointer-events-auto relative h-3 flex-1 cursor-pointer rounded-full bg-zinc-200/80 backdrop-blur-sm dark:bg-zinc-700/80"
        title={`水平：${Math.round(worldLeft)} / ${Math.round(worldWidth)}`}
      >
        {/* 整条上的"刻度"提示（首尾） */}
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] leading-none text-zinc-500">
          始
        </div>
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] leading-none text-zinc-500">
          末
        </div>

        {/* 滑块 */}
        <div
          className="absolute top-0 h-full rounded-full bg-blue-500/80 shadow-sm transition-[background] hover:bg-blue-600 active:bg-blue-700"
          style={{
            left: `${hThumbLeftPct * 100}%`,
            width: `${hThumbWidthPct * 100}%`,
            minWidth: 12,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setDragging("x");
          }}
        />
      </div>

      {/* 状态：当前 X / 总 X · 缩放 */}
      <div className="pointer-events-auto rounded-md bg-white/85 px-2 py-0.5 text-[10px] text-zinc-600 backdrop-blur dark:bg-zinc-900/85 dark:text-zinc-300">
        {fmtPct(hThumbLeftPct)} · {fmtZoom(zoom)}
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function fmtPct(p: number) {
  return `${Math.round(p * 100)}%`;
}
function fmtZoom(z: number) {
  return `×${z.toFixed(z < 1 ? 2 : 1)}`;
}
