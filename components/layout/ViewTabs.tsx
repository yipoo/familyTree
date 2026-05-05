"use client";

/**
 * 顶栏中段：当前家族下的视图切换 Tab（纯展示组件）。
 *
 * - 桌面：横排，icon + 文字 + 激活态下划线
 * - 移动：水平滚动条（不折叠到下拉，避免误触；> 768 才有空间）
 * - tab role + aria-current 提供屏幕阅读器语义
 *
 * 数据装配 (`buildFamilyTabs`) 移到了 view-tabs-config.ts，这样 server
 * 组件也能调用，避免 "Attempted to call ... from the server" 报错。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

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
} from "./icons";
export type { ViewTab } from "./view-tabs-config";

const ICON_MAP: Record<IconKey, React.ComponentType<{ size?: number }>> = {
  home: IconHome,
  tree: IconTree,
  table: IconTable,
  lineage: IconLineage,
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

  return (
    <nav
      aria-label="家族视图"
      className="-mb-px flex items-center gap-0.5 overflow-x-auto"
    >
      {tabs.map((t) => {
        const active = isActive(pathname, t.href, t.exact);
        const Icon = ICON_MAP[t.icon];
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              active
                ? "text-foreground"
                : "text-fg-muted hover:text-foreground"
            }`}
          >
            <Icon size={15} />
            <span>{t.label}</span>
            {t.badge ? (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-none text-white">
                {t.badge}
              </span>
            ) : null}
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(href + "/");
}
