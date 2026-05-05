/**
 * 全站统一顶部导航（服务端组件）。
 *
 * 三段式：
 * ```
 * [ Logo · 家族切换 ]    [ 视图 Tab ]    [ 快捷新增 · 主题 · 头像菜单 ]
 * ```
 *
 * - 公开路径（营销、登录、注册、分享、加入）+ 未登录态：返回 null
 * - 中段：仅在 /f/[familyId]/* 下显示 ViewTabs
 * - 右侧：QuickAddMenu 仅家族页；ThemeToggle / UserMenu 全程显示
 *
 * 数据：
 * - 当前 pathname：从 proxy.ts 写入的 x-pathname header 取
 * - memberships：当前用户的家族列表（family-switcher 用）
 * - canManage / pendingCount：当前家族的管理者徽标
 */

import Link from "next/link";
import { headers } from "next/headers";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageFamily } from "@/app/f/[familyId]/admin/actions";

import { FamilySwitcher, type SwitcherFamily } from "./FamilySwitcher";
import { ViewTabs, buildFamilyTabs } from "./ViewTabs";
import { UserMenu } from "./UserMenu";
import { QuickAddMenu } from "./QuickAddMenu";
import { ThemeToggle } from "./ThemeToggle";
import { MobileNav } from "./MobileNav";

const PUBLIC_EXACT = new Set([
  "/",
  "/pricing",
  "/features",
  "/about",
  "/login",
  "/register",
  "/join",
]);
const PUBLIC_PREFIXES = ["/share/", "/join/"];

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function TopNav() {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  if (!pathname || isPublic(pathname)) return null;

  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const userName = session.user.name ?? "";

  const familyMatch = pathname.match(/^\/f\/([^/]+)/);
  const currentFamilyId = familyMatch?.[1] ?? null;

  // 用户参与的所有家族
  const memberships = await prisma.familyMember.findMany({
    where: { userId },
    include: { family: { select: { id: true, name: true, surname: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformRole: true },
  });
  const isSuper = me?.platformRole === "SUPERADMIN";

  let currentFamily: SwitcherFamily | null = null;
  if (currentFamilyId) {
    const inMembership = memberships.find((m) => m.family.id === currentFamilyId);
    if (inMembership) {
      currentFamily = {
        id: inMembership.family.id,
        name: inMembership.family.name,
        surname: inMembership.family.surname,
        myRole: inMembership.role,
      };
    } else if (isSuper) {
      const f = await prisma.family.findUnique({
        where: { id: currentFamilyId },
        select: { id: true, name: true, surname: true },
      });
      if (f) {
        currentFamily = {
          id: f.id,
          name: f.name,
          surname: f.surname,
          myRole: "SUPERADMIN",
        };
      }
    }
  }

  const switcherList: SwitcherFamily[] = memberships.map((m) => ({
    id: m.family.id,
    name: m.family.name,
    surname: m.family.surname,
    myRole: m.role,
  }));
  // 超管在外族 URL 时，把当前家族临时加入列表
  if (
    currentFamily &&
    !switcherList.some((s) => s.id === currentFamily!.id)
  ) {
    switcherList.unshift(currentFamily);
  }

  const canManage = currentFamilyId
    ? await canManageFamily(currentFamilyId)
    : false;

  const pendingCount = canManage
    ? await prisma.pendingSubmission.count({
        where: { familyId: currentFamilyId!, status: "PENDING" },
      })
    : 0;

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
        {/* 移动端汉堡 */}
        <MobileNav
          current={currentFamily}
          memberships={switcherList}
          tabs={tabs}
        />

        {/* 品牌 + 家族 */}
        <Link
          href="/dashboard"
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
            {/* 移动端简化展示：只显示家族名 */}
            <span className="md:hidden truncate text-sm font-semibold text-foreground">
              {currentFamily.name}
            </span>
          </>
        )}

        {/* 中段：视图 Tab */}
        {currentFamily && (
          <nav className="ml-2 hidden min-w-0 flex-1 md:block">
            <ViewTabs tabs={tabs} />
          </nav>
        )}
        {!currentFamily && <div className="flex-1" />}

        {/* 右侧 */}
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
