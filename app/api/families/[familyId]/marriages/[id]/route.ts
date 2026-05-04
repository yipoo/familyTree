/**
 * GET    /api/families/[familyId]/marriages/[id]
 * PATCH  /api/families/[familyId]/marriages/[id]
 * DELETE /api/families/[familyId]/marriages/[id]
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  AuthError,
  canWriteOnPerson,
  requireFamilyRole,
  requireUser,
} from "@/lib/auth/guard";
import { handleApiError, notFound, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const PatchSchema = z.object({
  type: z.enum(["PRIMARY", "SECONDARY", "CONCUBINE", "UXORILOCAL"]).optional(),
  order: z.number().int().min(1).max(100).optional(),
  marriedYear: z.number().int().min(0).max(3000).nullable().optional(),
  endedYear: z.number().int().min(0).max(3000).nullable().optional(),
  endedReason: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; id: string }> },
) {
  const { familyId, id } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const m = await prisma.marriage.findFirst({
      where: { id, familyId },
      include: {
        husband: { select: { id: true, name: true, gender: true } },
        wife: { select: { id: true, name: true, gender: true } },
      },
    });
    if (!m) return notFound("婚配不存在");
    return NextResponse.json({ data: m });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ familyId: string; id: string }> },
) {
  const { familyId, id } = await ctx.params;
  try {
    const me = await requireUser();
    const json = await readJson<unknown>(req);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);

    const before = await prisma.marriage.findFirst({ where: { id, familyId } });
    if (!before) return notFound("婚配不存在");

    const can =
      (await canWriteOnPerson(me, familyId, before.husbandId)) ||
      (await canWriteOnPerson(me, familyId, before.wifeId));
    if (!can) throw new AuthError(403, "FORBIDDEN", "无权修改该婚配");

    const data: Record<string, unknown> = {};
    for (const k of [
      "type",
      "order",
      "marriedYear",
      "endedYear",
      "endedReason",
      "note",
    ] as const) {
      if (parsed.data[k] !== undefined) data[k] = parsed.data[k];
    }

    const updated = await prisma.marriage.update({ where: { id }, data });
    await writeAudit({
      familyId,
      actorId: me.id,
      kind: "UPDATE",
      entity: "Marriage",
      entityId: id,
      before,
      after: updated,
    });
    return NextResponse.json({ data: updated });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; id: string }> },
) {
  const { familyId, id } = await ctx.params;
  try {
    const me = await requireUser();
    const before = await prisma.marriage.findFirst({ where: { id, familyId } });
    if (!before) return notFound("婚配不存在");

    const can =
      (await canWriteOnPerson(me, familyId, before.husbandId)) ||
      (await canWriteOnPerson(me, familyId, before.wifeId));
    if (!can) throw new AuthError(403, "FORBIDDEN", "无权删除该婚配");

    await prisma.marriage.delete({ where: { id } });
    await writeAudit({
      familyId,
      actorId: me.id,
      kind: "DELETE",
      entity: "Marriage",
      entityId: id,
      before,
    });
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (e) {
    return handleApiError(e);
  }
}
