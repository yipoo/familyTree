/**
 * TopNavView —— TopNav 的纯展示版本，把 auth / prisma 数据全部当 props 接收。
 *
 * 用途：
 * 1. /preview/* 路由直接渲染，注入 mock 数据出 UI 截图
 * 2. 任何不需要走 cookie/数据库的场景下复用
 */

import Link from "next/link";

import { FamilySwitcher, type SwitcherFamily } from "./FamilySwitcher";
import { MobileNav } from "./MobileNav";
import { QuickAddMenu } from "./QuickAddMenu";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { ViewTabs } from "./ViewTabs";
import { buildFamilyTabs } from "./view-tabs-config";

export interface TopNavViewProps {
  userName: string;
  isSuper: boolean;
  currentFamily: SwitcherFamily | null;
  memberships: SwitcherFamily[];
  canManage: boolean;
  pendingCount: number;
  logoutAction: () => Promise<void>;
}

export function TopNavView({
  userName,
  isSuper,
  currentFamily,
  memberships,
  canManage,
  pendingCount,
  logoutAction,
}: TopNavViewProps) {
  const switcherList = [...memberships];
  if (currentFamily && !switcherList.some((s) => s.id === currentFamily.id)) {
    switcherList.unshift(currentFamily);
  }

  const tabs = currentFamily
    ? buildFamilyTabs({
        familyId: currentFamily.id,
        canManage,
        pendingCount,
      })
    : [];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-3 sm:px-5 lg:px-6">
        <MobileNav
          current={currentFamily}
          memberships={switcherList}
          tabs={tabs}
        />

        <Link
          href="/"
          aria-label="回到我的家族"
          className="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-[12px] font-semibold text-brand-fg shadow-sm"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            族
          </span>
          <span className="hidden text-sm font-semibold text-foreground sm:inline">
            族谱·家
          </span>
        </Link>

        {currentFamily && (
          <>
            <span className="hidden text-fg-subtle md:inline">/</span>
            <div className="hidden md:flex">
              <FamilySwitcher
                current={currentFamily}
                memberships={switcherList}
              />
            </div>
            <span className="md:hidden truncate text-sm font-semibold text-foreground">
              {currentFamily.name}
            </span>
          </>
        )}

        {currentFamily && (
          <nav className="ml-2 hidden min-w-0 flex-1 md:block">
            <ViewTabs tabs={tabs} />
          </nav>
        )}
        {!currentFamily && <div className="flex-1" />}

        <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-1.5">
          {!currentFamily && (
            <Link
              href="/join"
              className="hidden rounded-md border border-border px-2.5 py-1.5 text-xs text-fg-muted transition hover:bg-muted hover:text-foreground sm:inline-block"
            >
              + 加入家族
            </Link>
          )}
          {currentFamily && canManage && (
            <QuickAddMenu familyId={currentFamily.id} />
          )}
          <ThemeToggle />
          <UserMenu
            name={userName}
            isSuper={isSuper}
            logoutAction={logoutAction}
          />
        </div>
      </div>
    </header>
  );
}
