import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { LineageTabs } from "@/components/LineageTabs";
import { lineagePersonWhere, parseLineage } from "@/lib/services/lineage";
import { StatsCards } from "@/components/stats/StatsCards";
import { computeFamilyStats } from "@/lib/services/family-stats";

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

  const familyStats = await computeFamilyStats(familyId);

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
    <div>
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-4 py-6 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
              {family.surname} 氏 · 概览
            </p>
            <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {family.name}
            </h1>
            {family.description && (
              <p className="mt-1 max-w-3xl text-sm text-fg-muted">
                {family.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span className="text-fg-muted">
              人数{" "}
              <strong className="text-foreground">{stats.total}</strong>
            </span>
            <span className="text-fg-muted">
              男 <strong className="text-blue-600 dark:text-blue-400">{stats.male}</strong>
            </span>
            <span className="text-fg-muted">
              女 <strong className="text-pink-600 dark:text-pink-400">{stats.female}</strong>
            </span>
            <LineageTabs />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* 视图统计卡片 */}
        {familyStats && (
          <section className="mb-8">
            <h2 className="mb-3 text-base font-semibold text-foreground">
              概览
            </h2>
            <StatsCards familyId={familyId} stats={familyStats} />
          </section>
        )}

        {/* 字辈表 */}
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            字辈表
          </h2>
          <div className="overflow-x-auto">
            <div className="flex gap-2">
              {family.generationNames.map((g) => (
                <div
                  key={g.id}
                  className="flex min-w-[64px] flex-col items-center rounded-md border border-border bg-panel px-3 py-2 shadow-sm"
                >
                  <span className="text-xs text-fg-subtle">
                    {g.generation} 世
                  </span>
                  <span
                    className="mt-1 text-lg font-semibold text-foreground"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {g.character}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 支系 */}
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            支系
          </h2>
          <ul className="space-y-3">
            {family.branches.map((b) => (
              <li
                key={b.id}
                className="rounded-lg border border-border bg-panel p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <strong className="text-foreground">{b.name}</strong>
                  <span className="text-xs text-fg-subtle">
                    根 · {b.rootPerson.name} ｜ 人数 {b._count.persons}
                  </span>
                </div>
                {b.location && (
                  <p className="mt-1 text-sm text-fg-muted">
                    📍 {b.location.fullText}
                  </p>
                )}
                {b.migrations.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-fg-subtle">
                    {b.migrations.map((m) => (
                      <li key={m.id}>
                        {m.year} · {m.fromLocation?.village} →{" "}
                        {m.toLocation?.village}
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
          <h2 className="mb-3 text-base font-semibold text-foreground">
            人物（按世代）
          </h2>
          <div className="space-y-4">
            {generations.map((g) => {
              const list = byGen.get(g)!;
              const ch = charByGen.get(g);
              return (
                <div
                  key={g}
                  className="rounded-lg border border-border bg-panel p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-baseline gap-2">
                    <strong className="text-foreground">{g} 世</strong>
                    {ch && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-fg-muted">
                        字辈 {ch}
                      </span>
                    )}
                    <span className="text-xs text-fg-subtle">
                      {list.length} 人
                    </span>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {list.map((p) => (
                      <li
                        key={p.id}
                        className={`rounded px-2.5 py-1 text-sm ${
                          p.gender === "MALE"
                            ? "bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
                            : p.gender === "FEMALE"
                            ? "bg-pink-50 text-pink-900 dark:bg-pink-950/40 dark:text-pink-200"
                            : "bg-muted text-fg-muted"
                        }`}
                      >
                        {p.name}
                        {p.isMarriedIn && (
                          <span className="ml-1 text-xs opacity-60">
                            (嫁入)
                          </span>
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
