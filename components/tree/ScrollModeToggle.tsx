"use client";

export type ScrollMode = "zoom" | "scroll";

export function isScrollMode(v: unknown): v is ScrollMode {
  return v === "zoom" || v === "scroll";
}

export function ScrollModeToggle({
  value,
  onChange,
}: {
  value: ScrollMode;
  onChange: (next: ScrollMode) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(value === "zoom" ? "scroll" : "zoom")}
      title={
        value === "zoom"
          ? "滚轮：缩放（点击切换为滚动）"
          : "滚轮：滚动（按住 Cmd/Ctrl + 滚轮 可缩放；点击切换回缩放）"
      }
      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      <span aria-hidden>{value === "zoom" ? "🔍" : "↕"}</span>
      <span>滚轮：{value === "zoom" ? "缩放" : "滚动"}</span>
    </button>
  );
}
