import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorResponse, requireFamilyRole } from "@/lib/auth/guard";
import { buildResidenceResolver, resolveFromIndex } from "@/lib/services/residence";

/**
 * GET /api/families/[familyId]/persons/search?q=张&limit=20&gender=MALE
 *
 * 简单按 name / alias 模糊匹配；返回轻量字段供 UI 选择器使用。
 */
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
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Math.min(Math.max(limitRaw, 1), 50);
  const gender = url.searchParams.get("gender"); // MALE | FEMALE | UNKNOWN | null

  if (!q) {
    return NextResponse.json({ data: [] });
  }

  const persons = await prisma.person.findMany({
    where: {
      familyId,
      deletedAt: null,
      ...(gender ? { gender: gender as "MALE" | "FEMALE" | "UNKNOWN" } : {}),
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { alias: { contains: q, mode: "insensitive" } },
        { externalId: { contains: q } },
      ],
    },
    select: {
      id: true,
      name: true,
      alias: true,
      gender: true,
      generation: true,
      generationChar: true,
      isMarriedIn: true,
      status: true,
    },
    orderBy: [{ generation: "asc" }, { name: "asc" }],
    take: limit,
  });

  // 解析每条结果的居住地短名（村名优先），便于 UI 区分同名人物
  const residenceShortById: Map<string, string | null> = new Map();
  if (persons.length > 0) {
    const resolver = await buildResidenceResolver(familyId);
    const locIds = new Set<string>();
    const perPerson = new Map<string, string | null>();
    for (const p of persons) {
      const lid = resolveFromIndex(resolver, p.id);
      perPerson.set(p.id, lid);
      if (lid) locIds.add(lid);
    }
    if (locIds.size > 0) {
      const locs = await prisma.location.findMany({
        where: { id: { in: [...locIds] } },
        select: {
          id: true,
          village: true,
          town: true,
          county: true,
          city: true,
          province: true,
        },
      });
      const shortById = new Map<string, string>();
      for (const l of locs) {
        shortById.set(
          l.id,
          l.village || l.town || l.county || l.city || l.province || "",
        );
      }
      for (const [pid, lid] of perPerson) {
        residenceShortById.set(pid, lid ? shortById.get(lid) ?? null : null);
      }
    }
  }

  const data = persons.map((p) => ({
    ...p,
    residenceShort: residenceShortById.get(p.id) ?? null,
  }));

  return NextResponse.json({ data });
}
