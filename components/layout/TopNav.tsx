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
 *
 * 实际渲染交给 TopNavView 纯组件 —— 这样 /preview/* 等场景能复用同一个 UI。
 */

import { headers } from "next/headers";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageFamily } from "@/app/f/[familyId]/admin/actions";

import { TopNavView } from "./TopNavView";
import type { SwitcherFamily } from "./FamilySwitcher";

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

  const canManage = currentFamilyId
    ? await canManageFamily(currentFamilyId)
    : false;

  const pendingCount = canManage
    ? await prisma.pendingSubmission.count({
        where: { familyId: currentFamilyId!, status: "PENDING" },
      })
    : 0;

  return (
    <TopNavView
      userName={userName}
      isSuper={isSuper}
      currentFamily={currentFamily}
      memberships={switcherList}
      canManage={canManage}
      pendingCount={pendingCount}
      logoutAction={logoutAction}
    />
  );
}
