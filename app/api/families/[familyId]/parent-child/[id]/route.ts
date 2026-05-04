/**
 * GET    /api/families/[familyId]/parent-child/[id]
 * PATCH  /api/families/[familyId]/parent-child/[id]
 * DELETE /api/families/[familyId]/parent-child/[id]
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
  relation: z.enum(["BIOLOGICAL", "ADOPTED", "FOSTER", "STEP"]).optional(),
  birthOrder: z.number().int().min(0).max(100).nullable().optional(),
  isPrimary: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; id: string }> },
) {
  const { familyId, id } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const r = await prisma.parentChild.findFirst({
      where: { id, familyId },
      include: {
        parent: { select: { id: true, name: true, gender: true } },
        child: { select: { id: true, name: true, gender: true } },
      },
    });
    if (!r) return notFound("亲子关系不存在");
    return NextResponse.json({ data: r });
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

    const before = await prisma.parentChild.findFirst({ where: { id, familyId } });
    if (!before) return notFound("亲子关系不存在");

    const can =
      (await canWriteOnPerson(me, familyId, before.childId)) ||
      (await canWriteOnPerson(me, familyId, before.parentId));
    if (!can) throw new AuthError(403, "FORBIDDEN", "无权修改该亲子关系");

    const data: Record<string, unknown> = {};
    for (const k of ["relation", "birthOrder", "isPrimary"] as const) {
      if (parsed.data[k] !== undefined) data[k] = parsed.data[k];
    }

    // 若变 isPrimary=true，先剔除子的同性别其它 primary
    if (parsed.data.isPrimary === true) {
      const parent = await prisma.person.findUnique({
        where: { id: before.parentId },
        select: { gender: true },
      });
      if (parent) {
        await prisma.parentChild.updateMany({
          where: {
            familyId,
            childId: before.childId,
            id: { not: id },
            isPrimary: true,
            parent: { gender: parent.gender },
          },
          data: { isPrimary: false },
        });
      }
    }

    const updated = await prisma.parentChild.update({ where: { id }, data });
    await writeAudit({
      familyId,
      actorId: me.id,
      kind: "UPDATE",
      entity: "ParentChild",
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
    const before = await prisma.parentChild.findFirst({ where: { id, familyId } });
    if (!before) return notFound("亲子关系不存在");

    const can =
      (await canWriteOnPerson(me, familyId, before.childId)) ||
      (await canWriteOnPerson(me, familyId, before.parentId));
    if (!can) throw new AuthError(403, "FORBIDDEN", "无权删除该亲子关系");

    await prisma.parentChild.delete({ where: { id } });
    await writeAudit({
      familyId,
      actorId: me.id,
      kind: "DELETE",
      entity: "ParentChild",
      entityId: id,
      before,
    });
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (e) {
    return handleApiError(e);
  }
}
