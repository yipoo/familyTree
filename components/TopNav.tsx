/**
 * 全站统一顶部导航。
 *
 * - 服务端组件，读取 x-pathname（由 proxy.ts 写入）判断上下文
 * - 公开路径（登录/注册/分享/加入）和未登录态：返回 null
 * - 在家族上下文（/f/[id]/...）显示家族切换 + 树谱 / 详细图 / 后台 链接
 * - 后台链接仅当 canManageFamily 为真时显示
 * - 右上：用户名（→ /me）+ 退出
 */
import Link from "next/link";
import { headers } from "next/headers";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageFamily } from "@/app/f/[familyId]/admin/actions";
import { TopNavUserMenu } from "./TopNavUserMenu";
import { FamilySwitcherSelect } from "./FamilySwitcherSelect";

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

export async function TopNav() {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  if (!pathname || isPublic(pathname)) return null;

  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const userName = session.user.name ?? "";

  // 当前路径是否在某个家族上下文里
  const familyMatch = pathname.match(/^\/f\/([^/]+)/);
  const currentFamilyId = familyMatch?.[1] ?? null;

  // 用户参与的所有家族（用于切换）
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

  // SUPERADMIN 还可以看到自己未加入但 URL 当前指向的家族
  let currentFamily: { id: string; name: string; surname: string } | null = null;
  if (currentFamilyId) {
    const inMembership = memberships.find((m) => m.family.id === currentFamilyId);
    if (inMembership) currentFamily = inMembership.family;
    else if (isSuper) {
      currentFamily = await prisma.family.findUnique({
        where: { id: currentFamilyId },
        select: { id: true, name: true, surname: true },
      });
    }
  }

  const canManage = currentFamilyId
    ? await canManageFamily(currentFamilyId)
    : false;

  const pendingCount = canManage
    ? await prisma.pendingSubmission.count({
        where: { familyId: currentFamilyId!, status: "PENDING" },
      })
    : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* 品牌 */}
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50"
        >
          <span aria-hidden>📜</span>
          <span>家谱</span>
        </Link>

        {/* 家族上下文 */}
        {currentFamily && (
          <>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <FamilySwitcher
              currentId={currentFamily.id}
              currentName={currentFamily.name}
              memberships={memberships.map((m) => ({
                id: m.family.id,
                name: m.family.name,
                surname: m.family.surname,
              }))}
            />

            <nav className="hidden items-center gap-1 text-sm md:flex">
              <NavLink
                href={`/f/${currentFamily.id}`}
                pathname={pathname}
                exact
              >
                概览
              </NavLink>
              <NavLink
                href={`/f/${currentFamily.id}/tree`}
                pathname={pathname}
              >
                树谱
              </NavLink>
              <NavLink
                href={`/f/${currentFamily.id}/table`}
                pathname={pathname}
              >
                详细图
              </NavLink>
              {canManage && (
                <NavLink
                  href={`/f/${currentFamily.id}/admin`}
                  pathname={pathname}
                  badge={pendingCount > 0 ? pendingCount : undefined}
                >
                  后台
                </NavLink>
              )}
            </nav>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {!currentFamily && (
            <Link
              href="/join"
              className="hidden rounded border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 sm:inline-block"
            >
              + 加入家族
            </Link>
          )}
          <TopNavUserMenu
            name={userName}
            isSuper={isSuper}
            logoutAction={logoutAction}
          />
        </div>
      </div>
    </header>
  );
}

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function NavLink({
  href,
  pathname,
  children,
  exact,
  badge,
}: {
  href: string;
  pathname: string;
  children: React.ReactNode;
  exact?: boolean;
  badge?: number;
}) {
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`relative rounded px-2.5 py-1 transition ${
        active
          ? "bg-blue-100 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
      {badge ? (
        <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function FamilySwitcher({
  currentId,
  currentName,
  memberships,
}: {
  currentId: string;
  currentName: string;
  memberships: { id: string; name: string; surname: string }[];
}) {
  if (memberships.length <= 1) {
    return (
      <Link
        href={`/f/${currentId}`}
        className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
      >
        {currentName}
      </Link>
    );
  }
  return <FamilySwitcherSelect currentId={currentId} memberships={memberships} />;
}
