"use client";
import { useEffect } from "react";
import type { SpacingPreset } from "@/lib/services/tree-layout";

const OPTIONS: Array<{ value: SpacingPreset; label: string; key: "1" | "2" | "3" }> = [
  { value: "compact", label: "紧凑", key: "1" },
  { value: "normal", label: "适中", key: "2" },
  { value: "loose", label: "宽松", key: "3" },
];

export function SpacingControl({
  value,
  onChange,
}: {
  value: SpacingPreset;
  onChange: (next: SpacingPreset) => void;
}) {
  // 键盘快捷键 1/2/3——仅在没聚焦输入框时才响应
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const hit = OPTIONS.find((o) => o.key === e.key);
      if (!hit) return;
      e.preventDefault();
      onChange(hit.value);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onChange]);

  return (
    <div
      role="group"
      aria-label="节点间距"
      className="inline-flex overflow-hidden rounded-md border border-zinc-200 bg-white text-xs dark:border-zinc-700 dark:bg-zinc-900"
    >
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            title={`${o.label}（快捷键 ${o.key}）`}
            className={`px-2 py-1 leading-none transition-colors ${
              active
                ? "bg-blue-600 text-white"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
