/**
 * GET    /api/families/[familyId]/generations/[generation]
 * PATCH  /api/families/[familyId]/generations/[generation]    （含影响预览支持）
 * DELETE /api/families/[familyId]/generations/[generation]
 *
 * GET 时若带 ?preview=1，会返回如果替换 character 会影响哪些人物（不写库）。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyRole, requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, notFound, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const PatchSchema = z.object({
  character: z.string().trim().min(1).max(8),
  applyToPersons: z.boolean().optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string; generation: string }> },
) {
  const { familyId, generation: genRaw } = await ctx.params;
  const generation = Number(genRaw);
  try {
    await requireFamilyRole(familyId, "MEMBER");
    if (!Number.isFinite(generation) || generation < 1) {
      return notFound("非法世代号");
    }
    const url = new URL(req.url);
    const previewChar = url.searchParams.get("preview");

    const row = await prisma.generationName.findUnique({
      where: { familyId_generation: { familyId, generation } },
    });

    if (previewChar) {
      const persons = await prisma.person.findMany({
        where: { familyId, generation, deletedAt: null },
        select: { id: true, name: true, generationChar: true },
        orderBy: [{ birthOrder: "asc" }, { name: "asc" }],
      });
      const willChange = persons.filter((p) => p.generationChar !== previewChar);
      return NextResponse.json({
        data: {
          row,
          preview: {
            target: previewChar,
            totalPersons: persons.length,
            willChange: willChange.length,
            samples: willChange.slice(0, 50).map((p) => ({
              id: p.id,
              name: p.name,
              before: p.generationChar,
            })),
          },
        },
      });
    }

    if (!row) return notFound("该世代字辈未录入");
    return NextResponse.json({ data: row });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ familyId: string; generation: string }> },
) {
  const { familyId, generation: genRaw } = await ctx.params;
  const generation = Number(genRaw);
  try {
    const ctxAuth = await requireFamilyWrite(familyId);
    if (!Number.isFinite(generation) || generation < 1) {
      return notFound("非法世代号");
    }
    const json = await readJson<unknown>(req);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);

    const before = await prisma.generationName.findUnique({
      where: { familyId_generation: { familyId, generation } },
    });
    if (!before) return notFound("该世代字辈未录入");

    const after = await prisma.generationName.update({
      where: { id: before.id },
      data: { character: parsed.data.character },
    });

    let applied = 0;
    if (parsed.data.applyToPersons) {
      const r = await prisma.person.updateMany({
        where: { familyId, generation, deletedAt: null },
        data: { generationChar: parsed.data.character },
      });
      applied = r.count;
    }

    await writeAudit({
      familyId,
      actorId: ctxAuth.user.id,
      kind: "UPDATE",
      entity: "GenerationName",
      entityId: after.id,
      before,
      after: { ...after, applied },
    });

    return NextResponse.json({ data: { ...after, applied } });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; generation: string }> },
) {
  const { familyId, generation: genRaw } = await ctx.params;
  const generation = Number(genRaw);
  try {
    const ctxAuth = await requireFamilyWrite(familyId);
    if (!Number.isFinite(generation) || generation < 1) {
      return notFound("非法世代号");
    }
    const before = await prisma.generationName.findUnique({
      where: { familyId_generation: { familyId, generation } },
    });
    if (!before) return notFound("该世代字辈未录入");

    await prisma.generationName.delete({ where: { id: before.id } });
    await writeAudit({
      familyId,
      actorId: ctxAuth.user.id,
      kind: "DELETE",
      entity: "GenerationName",
      entityId: before.id,
      before,
    });

    return NextResponse.json({ data: { id: before.id, deleted: true } });
  } catch (e) {
    return handleApiError(e);
  }
}
