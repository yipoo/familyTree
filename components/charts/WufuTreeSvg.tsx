"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { WufuTreeLayout, WufuTreeNode } from "@/lib/services/wufu-tree";

const COLOR_LINE = "#94a3b8";
const COLOR_TEXT = "#0f172a";
const COLOR_TERM = "#475569";
const COLOR_MUTED = "#94a3b8";
const GEN_COL = 44; // 左侧世代标识宽
const MIN_K = 0.1;
const MAX_K = 2.5;

function nodeStyle(n: WufuTreeNode): { fill: string; stroke: string } {
  if (n.isSelf) return { fill: "#eef2ff", stroke: "#4f46e5" };
  if (n.col === 0) return { fill: "#ecfdf5", stroke: "#10b981" }; // 直系
  if (n.gender === "FEMALE") return { fill: "#ffffff", stroke: "#ec4899" }; // 本族女
  return { fill: "#ffffff", stroke: "#64748b" }; // 旁系男
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 五服树图：父→子挂线相连，节点标注「与己的称谓 + 姓名」，配偶做小字。
 * 画布可拖动平移、滚轮 / 按钮缩放，「适应窗口」看全貌、「回到己」回中心。
 * 点击血亲可改以其为中心重绘。
 */
export function WufuTreeSvg({
  layout,
  familyId,
}: {
  layout: WufuTreeLayout;
  familyId: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const contentW = layout.width + GEN_COL;
  const contentH = layout.height;

  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [ready, setReady] = useState(false);
  // 拖拽状态
  const drag = useRef<{
    x: number;
    y: number;
    tx: number;
    ty: number;
    moved: boolean;
  } | null>(null);
  const justDragged = useRef(false);

  const vp = () => {
    const el = wrapRef.current;
    return { vw: el?.clientWidth ?? 0, vh: el?.clientHeight ?? 0 };
  };

  const fit = useCallback(() => {
    const { vw, vh } = vp();
    if (!vw || !vh) return;
    const k = clamp(Math.min(vw / contentW, vh / contentH) * 0.96, MIN_K, 1);
    setView({ k, tx: (vw - contentW * k) / 2, ty: (vh - contentH * k) / 2 });
  }, [contentW, contentH]);

  const centerSelf = useCallback(
    (scale = 1) => {
      const { vw, vh } = vp();
      if (!vw || !vh) return;
      const self = layout.nodes.find((n) => n.isSelf);
      const cx = self ? self.x + GEN_COL + self.width / 2 : contentW / 2;
      const cy = self ? self.y + self.height / 2 : contentH / 2;
      setView({ k: scale, tx: vw / 2 - cx * scale, ty: vh / 2 - cy * scale });
    },
    [layout, contentW, contentH],
  );

  // 初始视图：整树放得下就居中到己(100%)，否则适应窗口看全貌。
  // 用 rAF 异步设置（避免在 effect 内同步 setState），定位后再显示，防闪烁。
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      const { vw, vh } = vp();
      if (!vw || !vh) return;
      if (contentW <= vw && contentH <= vh) centerSelf(1);
      else fit();
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, [centerSelf, fit, contentW, contentH]);

  // 缩放（围绕视口某点）
  const zoomAt = useCallback((factor: number, ox: number, oy: number) => {
    setView((v) => {
      const k = clamp(v.k * factor, MIN_K, MAX_K);
      const r = k / v.k;
      return { k, tx: ox - (ox - v.tx) * r, ty: oy - (oy - v.ty) * r };
    });
  }, []);

  const zoomBtn = (factor: number) => {
    const { vw, vh } = vp();
    zoomAt(factor, vw / 2, vh / 2);
  };

  // 滚轮缩放（非被动监听，可 preventDefault）
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(
        e.deltaY < 0 ? 1.1 : 1 / 1.1,
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      tx: view.tx,
      ty: view.ty,
      moved: false,
    };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) d.moved = true;
    setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }));
  }
  function endDrag() {
    if (drag.current?.moved) {
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 50);
    }
    drag.current = null;
  }

  function nodeClick(n: WufuTreeNode) {
    if (justDragged.current) return; // 刚才是拖拽，不触发跳转
    router.push(
      n.isSelf
        ? `/f/${familyId}/p/${n.id}`
        : `/f/${familyId}/wufu?root=${n.id}`,
      { scroll: false },
    );
  }

  const btn =
    "grid h-8 min-w-8 place-items-center rounded-md border border-border bg-surface px-2 text-xs font-medium text-foreground shadow-sm hover:bg-muted";

  return (
    <div className="relative">
      {/* 控件 */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 print:hidden">
        <button type="button" className={btn} onClick={() => zoomBtn(1.25)} title="放大">
          ＋
        </button>
        <button type="button" className={btn} onClick={() => zoomBtn(1 / 1.25)} title="缩小">
          －
        </button>
        <button type="button" className={btn} onClick={fit} title="适应窗口 · 查看全貌">
          适应
        </button>
        <button type="button" className={btn} onClick={() => centerSelf(1)} title="回到己">
          回到己
        </button>
      </div>

      <div
        ref={wrapRef}
        className="relative h-[78vh] cursor-grab touch-none select-none overflow-hidden rounded-lg border border-border bg-white active:cursor-grabbing print:h-auto print:overflow-visible print:border-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <div
          style={{
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.k})`,
            transformOrigin: "0 0",
            opacity: ready ? 1 : 0,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={contentW}
            height={contentH}
            viewBox={`0 0 ${contentW} ${contentH}`}
            style={{ fontFamily: "system-ui, sans-serif", display: "block" }}
          >
            {/* 左侧世代标识 */}
            {layout.rows.map((r) => (
              <text
                key={`g${r.genOffset}`}
                x={8}
                y={r.y + 26}
                fontSize={11}
                fontWeight={600}
                fill={COLOR_TERM}
              >
                {r.label}
              </text>
            ))}

            <g transform={`translate(${GEN_COL}, 0)`}>
              {/* 连线 */}
              {layout.lines.map((l, i) => (
                <line
                  key={`l${i}`}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke={COLOR_LINE}
                  strokeWidth={1.2}
                />
              ))}

              {/* 节点 */}
              {layout.nodes.map((n) => {
                const { fill, stroke } = nodeStyle(n);
                const spouseText = n.spouses.length
                  ? "配 " +
                    n.spouses.map((s) => `${s.term}·${s.name}`).join("、")
                  : "";
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x}, ${n.y})`}
                    style={{ cursor: "pointer" }}
                    onClick={() => nodeClick(n)}
                  >
                    <title>
                      {n.term} · {n.name}
                      {spouseText ? `（${spouseText}）` : ""}
                      {n.isSelf ? "" : "　点击以其为中心"}
                    </title>
                    <rect
                      width={n.width}
                      height={n.height}
                      rx={4}
                      ry={4}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={n.isSelf ? 2 : 1.2}
                    />
                    <text
                      x={n.width / 2}
                      y={15}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={600}
                      fill={n.isSelf ? "#4f46e5" : COLOR_TERM}
                    >
                      {n.term}
                    </text>
                    <text
                      x={n.width / 2}
                      y={31}
                      textAnchor="middle"
                      fontSize={13}
                      fontWeight={600}
                      fill={COLOR_TEXT}
                    >
                      {n.name}
                    </text>
                    {spouseText && (
                      <text
                        x={n.width / 2}
                        y={43}
                        textAnchor="middle"
                        fontSize={8.5}
                        fill={COLOR_MUTED}
                      >
                        {spouseText.length > 11
                          ? spouseText.slice(0, 10) + "…"
                          : spouseText}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* 操作提示 */}
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/55 px-2 py-1 text-[11px] text-white print:hidden">
          拖动平移 · 滚轮缩放 · 点节点换中心
        </div>
      </div>
    </div>
  );
}
