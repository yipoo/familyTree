"use client";

/**
 * 主题切换器：图标按钮 + 下拉菜单（Light / Dark / System）。
 *
 * 没有引入 Radix —— 用 details/summary + 自管 open 实现，
 * 保留键盘可达 + Esc 关闭 + 外点关闭。
 */

import { useEffect, useRef, useState } from "react";

import { useTheme } from "./ThemeProvider";
import type { Theme } from "./theme";
import {
  IconCheck,
  IconMonitor,
  IconMoon,
  IconSun,
} from "./icons";

const ITEMS: { value: Theme; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { value: "light", label: "浅色", icon: IconSun },
  { value: "dark", label: "深色", icon: IconMoon },
  { value: "system", label: "跟随系统", icon: IconMonitor },
];

export function ThemeToggle() {
  const { theme, resolved, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const Icon = resolved === "dark" ? IconMoon : IconSun;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="切换主题"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Icon size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-40 overflow-hidden rounded-md border border-border bg-panel py-1 text-sm shadow-lg"
        >
          {ITEMS.map((it) => {
            const ItemIcon = it.icon;
            const active = theme === it.value;
            return (
              <button
                key={it.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(it.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-foreground transition hover:bg-muted"
              >
                <ItemIcon size={14} />
                <span className="flex-1">{it.label}</span>
                {active && <IconCheck size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
