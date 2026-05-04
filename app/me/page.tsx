import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";

export const dynamic = "force-dynamic";

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const sp = await searchParams;
  const welcome = sp.welcome === "1";

  const session = await auth();
  const userId = session!.user.id;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      platformRole: true,
      createdAt: true,
    },
  });

  const [memberships, grants] = await Promise.all([
    prisma.familyMember.findMany({
      where: { userId },
      include: {
        family: { select: { id: true, name: true, surname: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.subtreeAdmin.findMany({
      where: { userId },
      include: {
        family: { select: { id: true, name: true } },
        root: { select: { id: true, name: true, generation: true } },
        grantedBy: { select: { name: true } },
      },
      orderBy: { grantedAt: "desc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-5 dark:border-zinc-800 dark:bg-zinc-900 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-xl font-semibold">个人设置</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-8">
        {welcome && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
            <strong className="text-emerald-900 dark:text-emerald-200">
              欢迎，{me?.name}！
            </strong>
            <p className="mt-1 text-emerald-700 dark:text-emerald-300">
              账号已创建。要查看家谱，请向族中长辈索取邀请码或邀请链接。
            </p>
            <Link
              href="/join"
              className="mt-2 inline-block rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              输入邀请码加入家族 →
            </Link>
          </div>
        )}

        {/* 基本信息 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-base font-semibold">基本信息</h2>
          <dl className="mb-4 grid grid-cols-[80px_1fr] gap-y-1.5 text-sm">
            <dt className="text-zinc-500">手机号</dt>
            <dd className="font-mono text-zinc-900 dark:text-zinc-100">
              {me?.phone ?? "—"}
            </dd>
            <dt className="text-zinc-500">注册时间</dt>
            <dd className="text-zinc-700 dark:text-zinc-300">
              {me?.createdAt
                ? new Date(me.createdAt).toLocaleString("zh-CN")
                : "—"}
            </dd>
            {me?.platformRole === "SUPERADMIN" && (
              <>
                <dt className="text-zinc-500">平台角色</dt>
                <dd>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    超级管理员
                  </span>
                </dd>
              </>
            )}
          </dl>
          <ProfileForm initialName={me?.name ?? ""} />
        </section>

        {/* 修改密码 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-base font-semibold">修改密码</h2>
          <PasswordForm />
        </section>

        {/* 我的家族 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-base font-semibold">
            我的家族（{memberships.length}）
          </h2>
          {memberships.length === 0 ? (
            <div className="rounded-md border border-dashed border-blue-300 bg-blue-50/40 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/30">
              <p className="text-zinc-700 dark:text-zinc-300">
                你还没有加入任何家族。
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                请向族中长辈索取邀请码或邀请链接。
              </p>
              <Link
                href="/join"
                className="mt-3 inline-block rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                输入邀请码加入 →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {memberships.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <Link
                    href={`/f/${m.family.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {m.family.name}
                    <span className="ml-1.5 text-xs text-zinc-400">
                      {m.family.surname} 姓
                    </span>
                  </Link>
                  <span className="text-xs text-zinc-500">
                    {roleLabel(m.role)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 子树授权 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-base font-semibold">
            我管理的子树（{grants.length}）
          </h2>
          <p className="mb-3 text-xs text-zinc-500">
            这些是其他管理员授权给你的「某人 + 父系后代」写权限。
          </p>
          {grants.length === 0 ? (
            <p className="text-sm text-zinc-500">暂无</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {grants.map((g) => (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <div>
                    <Link
                      href={`/f/${g.family.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {g.family.name}
                    </Link>
                    <span className="ml-2 text-zinc-700 dark:text-zinc-300">
                      {g.root.name}
                    </span>
                    <span className="ml-1.5 text-xs text-zinc-400">
                      第 {g.root.generation} 世
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    由 {g.grantedBy.name} 授权 ·{" "}
                    {new Date(g.grantedAt).toLocaleDateString("zh-CN")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function roleLabel(role: string) {
  switch (role) {
    case "OWNER":
      return "族长";
    case "ADMIN":
      return "管理员";
    case "MEMBER":
      return "成员";
    case "GUEST":
      return "访客";
    default:
      return role;
  }
}
