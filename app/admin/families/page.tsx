import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminFamiliesPage() {
  const families = await prisma.family.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          persons: true,
          members: true,
          branches: true,
          subtreeAdmins: true,
        },
      },
    },
  });

  // 单独取 owner 的 name（ownerId 字段无 relation）
  const ownerIds = [...new Set(families.map((f) => f.ownerId))];
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true, phone: true },
  });
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">家族管理</h1>
        <span className="text-xs text-zinc-500">共 {families.length} 个家族</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {families.map((f) => {
          const owner = ownerById.get(f.ownerId);
          return (
            <Link
              key={f.id}
              href={`/admin/families/${f.id}`}
              className="rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-baseline justify-between">
                <strong className="text-zinc-900 dark:text-zinc-50">{f.name}</strong>
                <span className="text-xs text-zinc-400">{f.surname} 姓</span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                创建者：{owner?.name ?? "—"}
                {owner?.phone && (
                  <span className="ml-1 font-mono">({owner.phone})</span>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-4 gap-2 text-xs">
                <Stat label="人数" value={f._count.persons} />
                <Stat label="成员" value={f._count.members} />
                <Stat label="支系" value={f._count.branches} />
                <Stat label="子树管" value={f._count.subtreeAdmins} />
              </dl>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-zinc-50 px-2 py-1 dark:bg-zinc-800">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
