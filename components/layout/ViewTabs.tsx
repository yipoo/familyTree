"use client";

/**
 * 顶栏中段：当前家族下的视图切换 Tab。
 *
 * - 桌面：横排，icon + 文字 + 激活态下划线
 * - 移动：水平滚动条（不折叠到下拉，避免误触；> 768 才有空间）
 * - tab role + aria-current 提供屏幕阅读器语义
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export interface ViewTab {
  href: string;
  label: string;
  /** 严格匹配 pathname == href */
  exact?: boolean;
  /** 角标 */
  badge?: number;
  /** 仅当布尔为 true 时才显示——譬如 admin 只有有权限的人能看 */
  show?: boolean;
  icon: React.ComponentType<{ size?: number }>;
}

export function buildFamilyTabs({
  familyId,
  canManage,
  pendingCount,
}: {
  familyId: string;
  canManage: boolean;
  pendingCount: number;
}): ViewTab[] {
  const tabs: ViewTab[] = [
    {
      href: `/f/${familyId}`,
      label: "概览",
      exact: true,
      icon: IconHome,
    },
    { href: `/f/${familyId}/tree`, label: "树谱", icon: IconTree },
    { href: `/f/${familyId}/table`, label: "详细图", icon: IconTable },
    { href: `/f/${familyId}/lineage`, label: "吊线图", icon: IconLineage },
    { href: `/f/${familyId}/album`, label: "册谱", icon: IconBook },
    { href: `/f/${familyId}/search`, label: "搜索", icon: IconSearch },
  ];
  if (canManage) {
    tabs.push({
      href: `/f/${familyId}/admin/migrations`,
      label: "迁徙",
      icon: IconRoute,
    });
    tabs.push({
      href: `/f/${familyId}/admin`,
      label: "后台",
      icon: IconShield,
      badge: pendingCount > 0 ? pendingCount : undefined,
    });
  }
  return tabs;
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
        const Icon = t.icon;
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
