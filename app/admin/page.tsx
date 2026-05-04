import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [userCount, superCount, familyCount, personCount, memberCount, subtreeAdminCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { platformRole: "SUPERADMIN" } }),
      prisma.family.count({ where: { deletedAt: null } }),
      prisma.person.count({ where: { deletedAt: null } }),
      prisma.familyMember.count(),
      prisma.subtreeAdmin.count(),
    ]);

  const cards = [
    {
      label: "用户总数",
      value: userCount,
      sub: `其中超级管理员 ${superCount}`,
      href: "/admin/users",
    },
    {
      label: "家族数",
      value: familyCount,
      sub: `家族成员 ${memberCount} 条`,
      href: "/admin/families",
    },
    {
      label: "人物总数",
      value: personCount,
      sub: "全平台所有家族",
    },
    {
      label: "子树管理员授权",
      value: subtreeAdminCount,
      sub: "细粒度子树写权限",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">概览</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="text-xs text-zinc-500">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</div>
            {c.sub && <div className="mt-1 text-xs text-zinc-500">{c.sub}</div>}
            {c.href && (
              <Link
                href={c.href}
                className="mt-3 inline-block text-xs text-blue-600 hover:underline"
              >
                查看 →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
