/**
 * GET    /api/families/[familyId]/branches/[branchId]   单条详情
 * PATCH  /api/families/[familyId]/branches/[branchId]   修改 name / rootPersonId / locationId / description（OWNER / ADMIN）
 * DELETE /api/families/[familyId]/branches/[branchId]   删除（仅 OWNER / ADMIN，挂载人物时返回 409）
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyRole, requireFamilyWrite } from "@/lib/auth/guard";
import {
  badRequest,
  conflict,
  handleApiError,
  notFound,
  readJson,
  zodError,
} from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const PatchSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    rootPersonId: z.string().min(1).optional(),
    locationId: z.string().min(1).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "至少修改一项");

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; branchId: string }> },
) {
  const { familyId, branchId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, familyId },
      include: {
        rootPerson: { select: { id: true, name: true, generation: true } },
        location: { select: { id: true, fullText: true } },
        _count: { select: { persons: true, migrations: true } },
      },
    });
    if (!branch) return notFound("支系不存在");
    return NextResponse.json({ data: branch });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ familyId: string; branchId: string }> },
) {
  const { familyId, branchId } = await ctx.params;
  try {
    const auth = await requireFamilyWrite(familyId);
    const json = await readJson<unknown>(req);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);
    const body = parsed.data;

    const before = await prisma.branch.findFirst({
      where: { id: branchId, familyId },
    });
    if (!before) return notFound("支系不存在");

    if (body.rootPersonId) {
      const ok = await prisma.person.findFirst({
        where: { id: body.rootPersonId, familyId, deletedAt: null },
        select: { id: true },
      });
      if (!ok) return badRequest("INVALID_ROOT", "根人物不存在或不属于该家族");
    }

    if (body.name && body.name !== before.name) {
      const dup = await prisma.branch.findFirst({
        where: { familyId, name: body.name, NOT: { id: branchId } },
        select: { id: true },
      });
      if (dup) return conflict("DUPLICATE_NAME", "已存在同名支系");
    }

    if (body.locationId) {
      const loc = await prisma.location.findUnique({
        where: { id: body.locationId },
        select: { id: true },
      });
      if (!loc) return badRequest("INVALID_LOCATION", "地点不存在");
    }

    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: body,
    });

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "UPDATE",
      entity: "Branch",
      entityId: branchId,
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
  ctx: { params: Promise<{ familyId: string; branchId: string }> },
) {
  const { familyId, branchId } = await ctx.params;
  try {
    const auth = await requireFamilyWrite(familyId);
    const before = await prisma.branch.findFirst({
      where: { id: branchId, familyId },
    });
    if (!before) return notFound("支系不存在");

    // 挂载人物 / 迁徙 → 拒绝直接删除
    const [personCount, migrationCount] = await Promise.all([
      prisma.person.count({ where: { branchId, familyId, deletedAt: null } }),
      prisma.migration.count({ where: { branchId, familyId } }),
    ]);
    if (personCount > 0 || migrationCount > 0) {
      return conflict(
        "IN_USE",
        `该支系下尚有 ${personCount} 位人物 / ${migrationCount} 条迁徙记录。请先迁出再删除。`,
      );
    }

    await prisma.branch.delete({ where: { id: branchId } });

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "DELETE",
      entity: "Branch",
      entityId: branchId,
      before,
    });

    return NextResponse.json({ data: { id: branchId, deleted: true } });
  } catch (e) {
    return handleApiError(e);
  }
}
