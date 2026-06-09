"use client";

/**
 * 顶栏中段：当前家族下的视图切换 Tab（纯展示组件）。
 *
 * - 桌面：横排；其中"图谱"类视图（树谱/详细图/吊线图/五服图/族谱圆）折叠进
 *   一个「图谱 ▾」下拉，避免标签过多挤爆顶栏
 * - 移动端在抽屉里平铺（见 MobileNav），不走本组件
 * - tab role + aria-current 提供屏幕阅读器语义
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { ViewTab, IconKey } from "./view-tabs-config";
import {
  IconBook,
  IconHome,
  IconLineage,
  IconRoute,
  IconSearch,
  IconShield,
  IconTable,
  IconTree,
  IconWufu,
  IconCircle,
} from "./icons";
export type { ViewTab } from "./view-tabs-config";

const ICON_MAP: Record<IconKey, React.ComponentType<{ size?: number }>> = {
  home: IconHome,
  tree: IconTree,
  table: IconTable,
  lineage: IconLineage,
  wufu: IconWufu,
  circle: IconCircle,
  book: IconBook,
  search: IconSearch,
  route: IconRoute,
  shield: IconShield,
};

export function resolveIcon(key: IconKey) {
  return ICON_MAP[key];
}

export function ViewTabs({ tabs }: { tabs: ViewTab[] }) {
  const pathname = usePathname() ?? "";
  const chartTabs = tabs.filter((t) => t.group === "chart");
  // 图谱下拉插在第一个 chart 标签的位置（chart 标签连续，位置即正确）
  const firstChartIndex = tabs.findIndex((t) => t.group === "chart");

  return (
    <nav aria-label="家族视图" className="-mb-px flex items-center gap-0.5 overflow-x-auto">
      {tabs.map((t, i) => {
        if (t.group === "chart") {
          return i === firstChartIndex ? (
            <ChartMenu key="__chart__" tabs={chartTabs} pathname={pathname} />
          ) : null;
        }
        return <TabLink key={t.href} t={t} active={isActive(pathname, t.href, t.exact)} />;
      })}
    </nav>
  );
}

function TabLink({ t, active }: { t: ViewTab; active: boolean }) {
  const Icon = ICON_MAP[t.icon];
  return (
    <Link
      href={t.href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        active ? "text-foreground" : "text-fg-muted hover:text-foreground"
      }`}
    >
      <Icon size={15} />
      <span>{t.label}</span>
      {t.badge ? (
        <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-none text-white">
          {t.badge}
        </span>
      ) : null}
      {active && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
    </Link>
  );
}

function ChartMenu({ tabs, pathname }: { tabs: ViewTab[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  // 下拉用 fixed 定位（避免被顶栏 overflow-x-auto 裁剪），开启时测量按钮位置
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // 路由变化即关闭（派生 state，避免 effect 级联）
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left });
    }
    setOpen((o) => !o);
  }

  const activeTab = tabs.find((t) => isActive(pathname, t.href, t.exact));
  const groupActive = Boolean(activeTab);
  const ActiveIcon = ICON_MAP[activeTab?.icon ?? "tree"];

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`group relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          groupActive ? "text-foreground" : "text-fg-muted hover:text-foreground"
        }`}
      >
        <ActiveIcon size={15} />
        <span>{activeTab ? activeTab.label : "图谱"}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
        {groupActive && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
      </button>

      {open && coords ? (
        <div
          role="menu"
          style={{ position: "fixed", top: coords.top, left: coords.left }}
          className="z-50 min-w-44 rounded-lg border border-border bg-panel p-1 shadow-lg"
        >
          {tabs.map((t) => {
            const active = isActive(pathname, t.href, t.exact);
            const Icon = ICON_MAP[t.icon];
            return (
              <Link
                key={t.href}
                href={t.href}
                role="menuitem"
                className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition ${
                  active ? "bg-brand-soft font-medium text-brand-soft-fg" : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon size={15} />
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(href + "/");
}
