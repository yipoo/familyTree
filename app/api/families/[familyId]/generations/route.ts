/**
 * GET  /api/families/[familyId]/generations              列出字辈表 + 各代人物数 + 缺漏世代
 * POST /api/families/[familyId]/generations              新增 / 替换一条
 *
 * 写权限：requireFamilyWrite
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyRole, requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const UpsertSchema = z.object({
  generation: z.number().int().min(1).max(200),
  character: z.string().trim().min(1).max(8),
  /** 是否同时把当代人物的 generationChar 一并刷新（默认 false） */
  applyToPersons: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const [gens, counts] = await Promise.all([
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
    const countByGen = new Map(counts.map((c) => [c.generation, c._count._all]));
    const missing = counts
      .map((c) => c.generation)
      .filter((g) => !gens.some((r) => r.generation === g))
      .sort((a, b) => a - b);

    return NextResponse.json({
      data: {
        rows: gens.map((g) => ({
          id: g.id,
          generation: g.generation,
          character: g.character,
          personCount: countByGen.get(g.generation) ?? 0,
        })),
        missing,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    const ctxAuth = await requireFamilyWrite(familyId);
    const json = await readJson<unknown>(req);
    const parsed = UpsertSchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);
    const body = parsed.data;

    const before = await prisma.generationName.findUnique({
      where: { familyId_generation: { familyId, generation: body.generation } },
    });

    const after = before
      ? await prisma.generationName.update({
          where: { id: before.id },
          data: { character: body.character },
        })
      : await prisma.generationName.create({
          data: {
            familyId,
            generation: body.generation,
            character: body.character,
          },
        });

    let applied = 0;
    if (body.applyToPersons) {
      const r = await prisma.person.updateMany({
        where: { familyId, generation: body.generation, deletedAt: null },
        data: { generationChar: body.character },
      });
      applied = r.count;
    }

    await writeAudit({
      familyId,
      actorId: ctxAuth.user.id,
      kind: before ? "UPDATE" : "CREATE",
      entity: "GenerationName",
      entityId: after.id,
      before,
      after: { ...after, applied },
    });

    return NextResponse.json({ data: { ...after, applied } }, { status: before ? 200 : 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
