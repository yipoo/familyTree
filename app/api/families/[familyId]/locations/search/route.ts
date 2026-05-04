/**
 * 地点搜索：返回该家族内已存在的 Location，按 village / fullText 模糊匹配。
 *
 * GET /api/families/[familyId]/locations/search?q=&limit=20
 *
 * 返回字段：
 *   id, village, fullText, short （= village || town || county || city || province）
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorResponse, requireFamilyRole } from "@/lib/auth/guard";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
  } catch (e) {
    return authErrorResponse(e);
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 50);

  // 找出该家族里有 Person 居住或 Branch 关联的 Location（限定为本族内出现过的地点）
  const personLocs = await prisma.person.findMany({
    where: { familyId, residenceId: { not: null } },
    select: { residenceId: true },
    distinct: ["residenceId"],
  });
  const branchLocs = await prisma.branch.findMany({
    where: { familyId, locationId: { not: null } },
    select: { locationId: true },
    distinct: ["locationId"],
  });
  const ids = [
    ...new Set([
      ...personLocs.map((p) => p.residenceId).filter(Boolean) as string[],
      ...branchLocs.map((b) => b.locationId).filter(Boolean) as string[],
    ]),
  ];

  if (ids.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const locations = await prisma.location.findMany({
    where: {
      id: { in: ids },
      ...(q
        ? {
            OR: [
              { village: { contains: q } },
              { town: { contains: q } },
              { county: { contains: q } },
              { city: { contains: q } },
              { fullText: { contains: q } },
            ],
          }
        : {}),
    },
    take: limit,
    orderBy: [{ village: "asc" }, { fullText: "asc" }],
  });

  const data = locations.map((l) => ({
    id: l.id,
    short: l.village || l.town || l.county || l.city || l.province || l.fullText,
    village: l.village,
    fullText: l.fullText,
  }));

  return NextResponse.json({ data });
}
