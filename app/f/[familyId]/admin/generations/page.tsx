import { prisma } from "@/lib/db";

import { AdminSection } from "../_shared";
import { GenerationsTable, AddGenerationForm } from "./Forms";

export const dynamic = "force-dynamic";

export default async function AdminGenerationsPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;

  const [gens, persons] = await Promise.all([
    prisma.generationName.findMany({
      where: { familyId },
      orderBy: { generation: "asc" },
    }),
    prisma.person.groupBy({
      by: ["generation"],
      where: { familyId, deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const personCountByGen = new Map(
    persons.map((p) => [p.generation, p._count._all]),
  );

  // 找出存在人物但缺字辈的世代
  const missing = persons
    .map((p) => p.generation)
    .filter((g) => !gens.some((row) => row.generation === g))
    .sort((a, b) => a - b);

  return (
    <AdminSection
      title={`字辈表（${gens.length}）`}
      description="字辈是同代族人共用的辈分字。每代一个汉字，新增人物时自动套用对应世代的字辈。"
    >
      <AddGenerationForm familyId={familyId} suggestNext={nextGen(gens, persons)} />

      {missing.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          以下世代有人物但未录入字辈：{missing.join("、")} 世
        </div>
      )}

      <div className="mt-5">
        <GenerationsTable
          familyId={familyId}
          rows={gens.map((g) => ({
            generation: g.generation,
            character: g.character,
            personCount: personCountByGen.get(g.generation) ?? 0,
          }))}
        />
      </div>
    </AdminSection>
  );
}

function nextGen(
  gens: { generation: number }[],
  persons: { generation: number }[],
): number {
  const all = new Set<number>();
  for (const g of gens) all.add(g.generation);
  for (const p of persons) all.add(p.generation);
  if (all.size === 0) return 1;
  return Math.max(...all) + 1;
}
