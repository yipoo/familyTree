import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { LineageTabs } from "@/components/LineageTabs";
import { lineagePersonWhere, parseLineage } from "@/lib/services/lineage";

export const dynamic = "force-dynamic";

export default async function FamilyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ familyId: string }>;
  searchParams: Promise<{ lineage?: string }>;
}) {
  const { familyId } = await params;
  const { lineage: lineageRaw } = await searchParams;
  const lineage = parseLineage(lineageRaw);

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: {
      generationNames: { orderBy: { generation: "asc" } },
      branches: {
        include: {
          location: true,
          rootPerson: true,
          migrations: {
            orderBy: { year: "asc" },
            include: { fromLocation: true, toLocation: true },
          },
          _count: { select: { persons: true } },
        },
      },
    },
  });

  if (!family) notFound();

  const persons = await prisma.person.findMany({
    where: {
      familyId,
      deletedAt: null,
      ...lineagePersonWhere(lineage),
    },
    orderBy: [{ generation: "asc" }, { createdAt: "asc" }],
  });

  const stats = {
    total: persons.length,
    male: persons.filter((p) => p.gender === "MALE").length,
    female: persons.filter((p) => p.gender === "FEMALE").length,
  };

  // 按世代分组
  const byGen = new Map<number, typeof persons>();
  for (const p of persons) {
    const arr = byGen.get(p.generation) ?? [];
    arr.push(p);
    byGen.set(p.generation, arr);
  }
  const generations = Array.from(byGen.keys()).sort((a, b) => a - b);
  const charByGen = new Map(family.generationNames.map((g) => [g.generation, g.character]));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-5 dark:border-zinc-800 dark:bg-zinc-900 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {family.name}
          </h1>
          {family.description && (
            <p className="mt-1 text-sm text-zinc-500">{family.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              人数 <strong className="text-zinc-900 dark:text-zinc-50">{stats.total}</strong>
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              男 <strong className="text-blue-600">{stats.male}</strong>
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              女 <strong className="text-pink-600">{stats.female}</strong>
            </span>
            <LineageTabs />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {/* 字辈表 */}
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            字辈表
          </h2>
          <div className="overflow-x-auto">
            <div className="flex gap-2">
              {family.generationNames.map((g) => (
                <div
                  key={g.id}
                  className="flex min-w-[64px] flex-col items-center rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="text-xs text-zinc-500">{g.generation} 世</span>
                  <span className="mt-1 text-lg font-semibold">{g.character}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 支系 */}
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            支系
          </h2>
          <ul className="space-y-3">
            {family.branches.map((b) => (
              <li
                key={b.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <strong className="text-zinc-900 dark:text-zinc-50">{b.name}</strong>
                  <span className="text-xs text-zinc-500">
                    根 · {b.rootPerson.name} ｜ 人数 {b._count.persons}
                  </span>
                </div>
                {b.location && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    📍 {b.location.fullText}
                  </p>
                )}
                {b.migrations.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-zinc-500">
                    {b.migrations.map((m) => (
                      <li key={m.id}>
                        {m.year} · {m.fromLocation?.village} → {m.toLocation?.village}
                        {m.reason && `（${m.reason}）`}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* 人物按世代列表 */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            人物（按世代）
          </h2>
          <div className="space-y-4">
            {generations.map((g) => {
              const list = byGen.get(g)!;
              const ch = charByGen.get(g);
              return (
                <div
                  key={g}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="mb-2 flex items-baseline gap-2">
                    <strong className="text-zinc-900 dark:text-zinc-50">
                      {g} 世
                    </strong>
                    {ch && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        字辈 {ch}
                      </span>
                    )}
                    <span className="text-xs text-zinc-500">{list.length} 人</span>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {list.map((p) => (
                      <li
                        key={p.id}
                        className={`rounded px-2.5 py-1 text-sm ${
                          p.gender === "MALE"
                            ? "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
                            : p.gender === "FEMALE"
                              ? "bg-pink-50 text-pink-900 dark:bg-pink-950 dark:text-pink-200"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800"
                        }`}
                      >
                        {p.name}
                        {p.isMarriedIn && (
                          <span className="ml-1 text-xs opacity-60">(嫁入)</span>
                        )}
                        {p.status === "DECEASED" && (
                          <span className="ml-1 text-xs opacity-60">†</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
