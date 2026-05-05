import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorResponse, requireFamilyRole } from "@/lib/auth/guard";

/**
 * GET /api/families/[familyId]/tree-filters/options
 *
 * 返回筛选面板需要的可选值集合（带 count）：
 *   - locations：本族出现过的居住地（聚合 distinct + 人数）
 *   - generationChars：本族字辈表（按世代排序）
 *   - generationRange：[minGeneration, maxGeneration]
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
  } catch (e) {
    return authErrorResponse(e);
  }

  const [family, persons, locations] = await Promise.all([
    prisma.family.findUnique({
      where: { id: familyId },
      include: {
        generationNames: { orderBy: { generation: "asc" } },
      },
    }),
    prisma.person.findMany({
      where: { familyId, deletedAt: null },
      select: { generation: true, residenceId: true },
    }),
    prisma.location.findMany({
      where: {
        residents: { some: { familyId, deletedAt: null } },
      },
      select: {
        id: true,
        province: true,
        city: true,
        county: true,
        town: true,
        village: true,
        fullText: true,
      },
    }),
  ]);
  if (!family) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Family not found" } },
      { status: 404 },
    );
  }

  // 聚合每个 location 的人数（仅显式 residenceId，不沿父系上溯——筛选面板上的数字
  // 给用户一个直观的"该地点在族谱里出现了几次"参照即可）
  const countByLoc = new Map<string, number>();
  let minGen = Number.POSITIVE_INFINITY;
  let maxGen = Number.NEGATIVE_INFINITY;
  for (const p of persons) {
    if (p.generation < minGen) minGen = p.generation;
    if (p.generation > maxGen) maxGen = p.generation;
    if (p.residenceId) {
      countByLoc.set(p.residenceId, (countByLoc.get(p.residenceId) ?? 0) + 1);
    }
  }
  if (!Number.isFinite(minGen)) minGen = 0;
  if (!Number.isFinite(maxGen)) maxGen = 0;

  const locOptions = locations
    .map((l) => ({
      id: l.id,
      // 短名优先（村）；fallback 到 fullText
      label: l.village || l.town || l.county || l.city || l.fullText,
      fullText: l.fullText,
      province: l.province,
      city: l.city,
      county: l.county,
      town: l.town,
      village: l.village,
      count: countByLoc.get(l.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.fullText.localeCompare(b.fullText, "zh-Hans-CN"));

  return NextResponse.json(
    {
      data: {
        locations: locOptions,
        generationChars: family.generationNames.map((g) => ({
          generation: g.generation,
          character: g.character,
        })),
        generationRange: { min: minGen, max: maxGen },
      },
    },
    {
      headers: { "Cache-Control": "private, max-age=300" },
    },
  );
}
