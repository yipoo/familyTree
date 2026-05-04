import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  // middleware 已挡过；这里 session.user 一定存在
  const userId = session!.user.id;
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, phone: true, platformRole: true },
  });

  const isSuper = me?.platformRole === "SUPERADMIN";

  // SUPERADMIN 看到所有家族；普通用户仅看到自己加入的
  const families = isSuper
    ? await prisma.family.findMany({
        where: { deletedAt: null },
        include: {
          _count: {
            select: { persons: true, branches: true, generationNames: true },
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : (
        await prisma.familyMember.findMany({
          where: { userId },
          include: {
            family: {
              include: {
                _count: {
                  select: {
                    persons: true,
                    branches: true,
                    generationNames: true,
                  },
                },
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        })
      ).map((m) => ({ ...m.family, myRole: m.role }));

  // SubtreeAdmin 信息（普通用户用，便于看到自己除常规角色外，还管理哪些子树）
  const subtreeGrants = isSuper
    ? []
    : await prisma.subtreeAdmin.findMany({
        where: { userId },
        select: {
          familyId: true,
          rootPersonId: true,
          root: { select: { name: true, generation: true } },
        },
      });
  const grantsByFamily = new Map<string, typeof subtreeGrants>();
  for (const g of subtreeGrants) {
    const arr = grantsByFamily.get(g.familyId) ?? [];
    arr.push(g);
    grantsByFamily.set(g.familyId, arr);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-6 dark:border-zinc-800 dark:bg-zinc-900 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            家谱系统
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Web 一期 · 骨架验证页
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
          {isSuper ? "全部家族" : "我的家族"}
        </h2>

        {families.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              你还没有加入任何家族
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              请向族中长辈索取邀请码（8 位字母+数字），或邀请链接
            </p>
            <Link
              href="/join"
              className="mt-4 inline-block rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              输入邀请码加入 →
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {families.map((f) => {
              const myRole = (f as { myRole?: string }).myRole;
              const grants = grantsByFamily.get(f.id) ?? [];
              return (
                <li
                  key={f.id}
                  className="rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                      {f.name}
                    </h3>
                    <span className="text-xs text-zinc-400">{f.surname} 姓</span>
                  </div>
                  {f.description && (
                    <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                      {f.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    {myRole && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        {roleLabel(myRole)}
                      </span>
                    )}
                    {grants.map((g) => (
                      <span
                        key={g.rootPersonId}
                        className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      >
                        管 {g.root.name}（第 {g.root.generation} 世）支
                      </span>
                    ))}
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <Stat label="人数" value={f._count.persons} />
                    <Stat label="支系" value={f._count.branches} />
                    <Stat label="字辈" value={f._count.generationNames} />
                  </dl>
                  <Link
                    href={`/f/${f.id}`}
                    className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    查看 →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 font-semibold text-zinc-900 dark:text-zinc-50">{value}</dd>
    </div>
  );
}
