/**
 * 高级搜索：在简单 search 之外提供更细的过滤维度。
 *
 * GET /api/families/[familyId]/persons/advanced-search?
 *   q=                 (可空)
 *   gender=MALE|FEMALE|UNKNOWN
 *   minGen=N
 *   maxGen=N
 *   generationChar=
 *   isMarriedIn=true|false
 *   status=ALIVE|DECEASED|LOST|UNKNOWN
 *   minBirthYear=
 *   maxBirthYear=
 *   minDeathYear=
 *   maxDeathYear=
 *   birthPlace=        (contains)
 *   branchId=
 *   residenceLocationId=  (按解析后的居住地过滤)
 *   limit=  默认 50，最大 200
 *   sort=   name | generation | birthYear | -name | -generation | -birthYear
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyRole } from "@/lib/auth/guard";
import { handleApiError, zodError } from "@/lib/api/error";
import { buildResidenceResolver, resolveFromIndex } from "@/lib/services/residence";

const QuerySchema = z.object({
  q: z.string().trim().optional(),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]).optional(),
  minGen: z.coerce.number().int().min(1).max(200).optional(),
  maxGen: z.coerce.number().int().min(1).max(200).optional(),
  generationChar: z.string().trim().optional(),
  isMarriedIn: z.enum(["true", "false"]).optional(),
  status: z.enum(["ALIVE", "DECEASED", "LOST", "UNKNOWN"]).optional(),
  minBirthYear: z.coerce.number().int().min(0).max(3000).optional(),
  maxBirthYear: z.coerce.number().int().min(0).max(3000).optional(),
  minDeathYear: z.coerce.number().int().min(0).max(3000).optional(),
  maxDeathYear: z.coerce.number().int().min(0).max(3000).optional(),
  birthPlace: z.string().trim().optional(),
  branchId: z.string().optional(),
  residenceLocationId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort: z
    .enum([
      "name",
      "-name",
      "generation",
      "-generation",
      "birthYear",
      "-birthYear",
    ])
    .optional(),
});

type Where = Record<string, unknown>;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return zodError(parsed.error);
    const f = parsed.data;

    const where: Where = { familyId, deletedAt: null };
    const ands: Where[] = [];

    if (f.gender) where.gender = f.gender;
    if (f.status) where.status = f.status;
    if (f.generationChar) where.generationChar = f.generationChar;
    if (f.isMarriedIn) where.isMarriedIn = f.isMarriedIn === "true";
    if (f.branchId) where.branchId = f.branchId;
    if (f.minGen != null || f.maxGen != null) {
      const range: Record<string, number> = {};
      if (f.minGen != null) range.gte = f.minGen;
      if (f.maxGen != null) range.lte = f.maxGen;
      where.generation = range;
    }
    if (f.minBirthYear != null || f.maxBirthYear != null) {
      const range: Record<string, number> = {};
      if (f.minBirthYear != null) range.gte = f.minBirthYear;
      if (f.maxBirthYear != null) range.lte = f.maxBirthYear;
      where.birthYear = range;
    }
    if (f.minDeathYear != null || f.maxDeathYear != null) {
      const range: Record<string, number> = {};
      if (f.minDeathYear != null) range.gte = f.minDeathYear;
      if (f.maxDeathYear != null) range.lte = f.maxDeathYear;
      where.deathYear = range;
    }
    if (f.birthPlace) {
      where.birthPlace = { contains: f.birthPlace, mode: "insensitive" };
    }
    if (f.q) {
      ands.push({
        OR: [
          { name: { contains: f.q, mode: "insensitive" } },
          { alias: { contains: f.q, mode: "insensitive" } },
          { externalId: { contains: f.q } },
        ],
      });
    }
    if (ands.length > 0) where.AND = ands;

    const orderBy = mapSort(f.sort);
    const persons = await prisma.person.findMany({
      where,
      orderBy,
      take: f.limit,
      select: {
        id: true,
        name: true,
        alias: true,
        gender: true,
        generation: true,
        generationChar: true,
        birthYear: true,
        deathYear: true,
        birthPlace: true,
        status: true,
        isMarriedIn: true,
        residenceId: true,
        branchId: true,
      },
    });

    // 居住地继承 + 可选过滤
    let final = persons;
    if (f.residenceLocationId || persons.length > 0) {
      const resolver = await buildResidenceResolver(familyId);
      const withLoc = persons.map((p) => ({
        ...p,
        resolvedLocationId: resolveFromIndex(resolver, p.id),
      }));
      if (f.residenceLocationId) {
        final = withLoc.filter((p) => p.resolvedLocationId === f.residenceLocationId);
      } else {
        final = withLoc;
      }
    }

    return NextResponse.json({
      data: {
        items: final,
        count: final.length,
        limit: f.limit,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

function mapSort(s?: string): { [k: string]: "asc" | "desc" }[] {
  if (!s) return [{ generation: "asc" }, { name: "asc" }];
  const desc = s.startsWith("-");
  const key = desc ? s.slice(1) : s;
  return [{ [key]: desc ? "desc" : "asc" }];
}
