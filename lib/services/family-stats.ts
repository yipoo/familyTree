/**
 * 家族级统计计算（与 /api/.../stats 共享逻辑）。
 * 服务端组件可直接 import；API 路由也复用本函数。
 */
import { prisma } from "@/lib/db";
import { buildResidenceResolver, resolveFromIndex } from "@/lib/services/residence";
import type { StatsData } from "@/components/stats/StatsCards";

export async function computeFamilyStats(familyId: string): Promise<StatsData | null> {
  const family = await prisma.family.findFirst({
    where: { id: familyId, deletedAt: null },
    select: { id: true, name: true, surname: true },
  });
  if (!family) return null;

  const [
    total,
    byGender,
    byStatus,
    byGen,
    generationsTbl,
    branches,
    branchCounts,
    marriagesCount,
    malesWithKidsCount,
    childrenTotalAggr,
    oldest,
    youngest,
    audit30,
    persons,
  ] = await Promise.all([
    prisma.person.count({ where: { familyId, deletedAt: null } }),
    prisma.person.groupBy({
      by: ["gender"],
      where: { familyId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.person.groupBy({
      by: ["status"],
      where: { familyId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.person.groupBy({
      by: ["generation"],
      where: { familyId, deletedAt: null },
      _count: { _all: true },
      orderBy: { generation: "asc" },
    }),
    prisma.generationName.findMany({
      where: { familyId },
      orderBy: { generation: "asc" },
    }),
    prisma.branch.findMany({
      where: { familyId },
      orderBy: { name: "asc" },
    }),
    prisma.person.groupBy({
      by: ["branchId"],
      where: { familyId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.marriage.count({ where: { familyId } }),
    prisma.parentChild.groupBy({
      by: ["parentId"],
      where: { familyId, parent: { gender: "MALE" } },
      _count: { _all: true },
    }),
    prisma.parentChild.count({ where: { familyId } }),
    prisma.person.findFirst({
      where: { familyId, deletedAt: null, birthYear: { not: null } },
      orderBy: { birthYear: "asc" },
      select: { id: true, name: true, birthYear: true, generation: true },
    }),
    prisma.person.findFirst({
      where: { familyId, deletedAt: null, birthYear: { not: null } },
      orderBy: { birthYear: "desc" },
      select: { id: true, name: true, birthYear: true, generation: true },
    }),
    prisma.auditLog.count({
      where: {
        familyId,
        createdAt: { gte: new Date(Date.now() - 30 * 86400_000) },
      },
    }),
    prisma.person.findMany({
      where: { familyId, deletedAt: null },
      select: { id: true },
    }),
  ]);

  const presentGenerations = byGen.map((g) => g.generation);
  const charsByGen = new Set(generationsTbl.map((g) => g.generation));
  const missingGenerations = presentGenerations.filter((g) => !charsByGen.has(g));
  const generationCoverage =
    presentGenerations.length === 0
      ? 1
      : presentGenerations.filter((g) => charsByGen.has(g)).length /
        presentGenerations.length;

  const resolver = await buildResidenceResolver(familyId);
  const locCount = new Map<string, number>();
  for (const p of persons) {
    const lid = resolveFromIndex(resolver, p.id);
    if (!lid) continue;
    locCount.set(lid, (locCount.get(lid) ?? 0) + 1);
  }
  const topLocIds = [...locCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const locs = topLocIds.length
    ? await prisma.location.findMany({
        where: { id: { in: topLocIds.map(([id]) => id) } },
        select: {
          id: true,
          village: true,
          town: true,
          county: true,
          city: true,
          province: true,
          fullText: true,
        },
      })
    : [];
  const locById = new Map(locs.map((l) => [l.id, l]));
  const topResidences = topLocIds.map(([id, count]) => {
    const l = locById.get(id);
    return {
      id,
      count,
      short: l ? l.village || l.town || l.county || l.city || l.province || "" : "",
      fullText: l?.fullText ?? "",
    };
  });

  const branchById = new Map(branches.map((b) => [b.id, b]));
  const branchStats = branchCounts.map((bc) => ({
    branchId: bc.branchId ?? null,
    branchName: bc.branchId
      ? branchById.get(bc.branchId)?.name ?? "—"
      : "（未分支）",
    count: bc._count._all,
  }));

  const avgChildrenPerFather =
    malesWithKidsCount.length === 0
      ? 0
      : malesWithKidsCount.reduce((s, x) => s + x._count._all, 0) /
        malesWithKidsCount.length;

  return {
    totalPersons: total,
    byGender: Object.fromEntries(byGender.map((g) => [g.gender, g._count._all])),
    byStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])),
    generationCounts: byGen.map((g) => ({
      generation: g.generation,
      count: g._count._all,
    })),
    generationCoverage,
    missingGenerations,
    knownGenerationChars: generationsTbl.length,
    branchStats,
    marriagesCount,
    avgChildrenPerFather: Number(avgChildrenPerFather.toFixed(2)),
    totalChildrenRelations: childrenTotalAggr,
    oldest,
    youngest,
    topResidences,
    recentWrites30d: audit30,
  };
}
