import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildFamilyUnits } from "@/lib/services/family-units";
import { LineageTabs } from "@/components/LineageTabs";
import { parseLineage } from "@/lib/services/lineage";

export const dynamic = "force-dynamic";

export default async function DetailTablePage({
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
    include: { generationNames: { orderBy: { generation: "asc" } } },
  });
  if (!family) notFound();

  const [persons, marriages, parentChild] = await Promise.all([
    prisma.person.findMany({ where: { familyId, deletedAt: null } }),
    prisma.marriage.findMany({ where: { familyId } }),
    prisma.parentChild.findMany({ where: { familyId } }),
  ]);

  const allUnits = buildFamilyUnits({
    persons: persons.map((p) => ({
      id: p.id,
      name: p.name,
      gender: p.gender,
      generation: p.generation,
      generationChar: p.generationChar,
      status: p.status,
      isMarriedIn: p.isMarriedIn,
    })),
    marriages,
    parentChild: parentChild.map((pc) => ({
      parentId: pc.parentId,
      childId: pc.childId,
      birthOrder: pc.birthOrder,
    })),
  });

  // lineage 过滤：父系=丈夫为男（默认所有 unit）；母系=保留所有有女性子女或女性丈夫的；全部=所有
  const units =
    lineage === "maternal"
      ? allUnits
          .map((u) => ({
            ...u,
            children: u.children.filter((c) => c.person.gender === "FEMALE"),
          }))
          .filter((u) => u.children.length > 0)
      : allUnits;

  // 按世代分组
  const byGen = new Map<number, typeof units>();
  for (const u of units) {
    const arr = byGen.get(u.generation) ?? [];
    arr.push(u);
    byGen.set(u.generation, arr);
  }
  const generations = Array.from(byGen.keys()).sort((a, b) => a - b);
  const charByGen = new Map(
    family.generationNames.map((g) => [g.generation, g.character]),
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1">
          <Link
            href={`/f/${family.id}`}
            className="text-sm text-zinc-500 hover:underline"
          >
            ←
          </Link>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {family.name} · 详细图
          </h1>
          <LineageTabs />
          <span className="ml-auto text-xs text-zinc-500">
            {units.length} 个家庭单元
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-6">
        {generations.map((g) => {
          const arr = byGen.get(g)!;
          return (
            <section key={g} className="mb-8">
              <h2 className="sticky top-0 z-10 -mx-3 mb-3 border-b border-zinc-200 bg-zinc-50/95 px-3 py-2 text-sm font-semibold backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:-mx-6 sm:px-6">
                <span className="text-zinc-900 dark:text-zinc-50">{g} 世</span>
                {charByGen.get(g) && (
                  <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    字辈 {charByGen.get(g)}
                  </span>
                )}
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  {arr.length} 单元
                </span>
              </h2>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {arr.map((u) => (
                  <article
                    key={u.id}
                    className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    {/* 夫 */}
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-base font-semibold text-blue-700 dark:text-blue-300">
                        {u.husband.name}
                      </span>
                      {u.husband.generationChar && (
                        <span className="text-xs text-zinc-400">
                          ({u.husband.generationChar})
                        </span>
                      )}
                      {u.husband.status === "DECEASED" && (
                        <span className="text-xs text-zinc-400">†</span>
                      )}
                    </div>

                    {/* 妻 */}
                    {u.wives.length > 0 && (
                      <div className="mt-2 space-y-0.5 text-sm">
                        {u.wives.map((w) => (
                          <div key={w.person.id} className="flex flex-wrap items-baseline gap-x-1.5">
                            <span className="text-xs text-zinc-500">
                              {w.type === "PRIMARY"
                                ? "妻"
                                : w.type === "SECONDARY"
                                  ? "继妻"
                                  : w.type === "UXORILOCAL"
                                    ? "招赘"
                                    : "妾"}
                            </span>
                            <span className="text-pink-700 dark:text-pink-300">
                              {w.person.name}
                            </span>
                            {w.person.status === "DECEASED" && (
                              <span className="text-xs text-zinc-400">已故</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 子女 */}
                    {u.children.length > 0 && (
                      <div className="mt-3 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                        <div className="text-xs text-zinc-500">
                          子女 {u.children.length}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {u.children.map((c) => (
                            <span
                              key={c.person.id}
                              className={`rounded px-2 py-0.5 text-sm ${
                                c.person.gender === "MALE"
                                  ? "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
                                  : "bg-pink-50 text-pink-900 dark:bg-pink-950 dark:text-pink-200"
                              }`}
                            >
                              {c.person.name}
                              {c.person.generationChar && (
                                <span className="ml-0.5 text-[10px] opacity-60">
                                  ({c.person.generationChar})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        {units.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            暂无家庭单元数据
          </div>
        )}
      </main>
    </div>
  );
}
