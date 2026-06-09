/**
 * GET    /api/families/[familyId]   家族详情（成员可读）
 * PATCH  /api/families/[familyId]   修改 surname / name / description / founderName / isPublic（OWNER / ADMIN）
 * DELETE /api/families/[familyId]   软删（仅 OWNER；写 deletedAt = now()）
 *
 * 家族列表 / 家族详情 / 任何依赖 family 的查询都会自然过滤 deletedAt != null
 * 的家族（参见 app/api/families/route.ts、lib/services/family-stats.ts 等）。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  requireFamilyRole,
  requireFamilyWrite,
  requireUser,
} from "@/lib/auth/guard";
import { handleApiError, notFound, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const PatchSchema = z
  .object({
    surname: z.string().trim().min(1).max(20).optional(),
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    founderName: z.string().trim().max(40).nullable().optional(),
    /** 仅 OWNER 可改公开开关；ADMIN 也允许（家族管理职责） */
    isPublic: z.boolean().optional(),
    /** 印刷家谱专用 */
    familyRules: z.string().trim().max(20000).nullable().optional(),
    editionInfo: z.string().trim().max(40).nullable().optional(),
    surnameOrigin: z.string().trim().max(5000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "至少修改一项");

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    const auth = await requireFamilyRole(familyId, "MEMBER");
    const family = await prisma.family.findFirst({
      where: { id: familyId, deletedAt: null },
      include: {
        _count: {
          select: { persons: true, members: true, branches: true },
        },
      },
    });
    if (!family) return notFound("家族不存在");

    return NextResponse.json({
      data: {
        ...family,
        myRole: auth.role,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    const auth = await requireFamilyWrite(familyId);
    const json = await readJson<unknown>(req);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);

    const before = await prisma.family.findFirst({
      where: { id: familyId, deletedAt: null },
    });
    if (!before) return notFound("家族不存在");

    const after = await prisma.family.update({
      where: { id: familyId },
      data: parsed.data,
    });

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "UPDATE",
      entity: "Family",
      entityId: familyId,
      before,
      after,
    });

    return NextResponse.json({ data: after });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    const user = await requireUser();
    const before = await prisma.family.findFirst({
      where: { id: familyId, deletedAt: null },
    });
    if (!before) return notFound("家族不存在");

    // 仅 OWNER（或 SUPERADMIN）可软删
    if (user.platformRole !== "SUPERADMIN" && before.ownerId !== user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "仅族长可删除家族" } },
        { status: 403 },
      );
    }

    const after = await prisma.family.update({
      where: { id: familyId },
      data: { deletedAt: new Date() },
    });

    await writeAudit({
      familyId,
      actorId: user.id,
      kind: "DELETE",
      entity: "Family",
      entityId: familyId,
      before,
      after,
    });

    return NextResponse.json({ data: { id: familyId, deletedAt: after.deletedAt } });
  } catch (e) {
    return handleApiError(e);
  }
}
