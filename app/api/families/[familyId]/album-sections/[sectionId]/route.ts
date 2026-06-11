/**
 * 册谱前置章节：单条改 / 删
 *
 *   PATCH   修改标题 / 正文 / 落款 / 配图 / 开关 / 适用版式（至少一项）
 *   DELETE  删除——仅自定义章节可删；系统/文本/封面章节返回 403（只能关不能删）
 *
 * 权限：requireFamilyWrite（族长 / 管理员）。where 带 familyId 防越权。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyWrite } from "@/lib/auth/guard";
import {
  handleApiError,
  readJson,
  zodError,
  notFound,
  forbidden,
} from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";
import { ossSignIfOurs } from "@/lib/services/oss";
import { canDeleteKind } from "@/lib/services/album-sections";

const PatchSchema = z
  .object({
    title: z.string().trim().max(80).nullable().optional(),
    subtitle: z.string().trim().max(120).nullable().optional(),
    body: z.string().max(50000).nullable().optional(),
    signature: z.string().trim().max(200).nullable().optional(),
    imageUrl: z.string().trim().max(4000).nullable().optional(),
    enabled: z.boolean().optional(),
    appliesTo: z.array(z.string().max(20)).max(8).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "无可更新字段" });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ familyId: string; sectionId: string }> },
) {
  const { familyId, sectionId } = await ctx.params;
  try {
    const auth = await requireFamilyWrite(familyId);
    const parsed = PatchSchema.safeParse((await readJson<unknown>(req)) ?? {});
    if (!parsed.success) return zodError(parsed.error);

    const before = await prisma.albumSection.findFirst({
      where: { id: sectionId, familyId },
    });
    if (!before) return notFound("章节不存在");

    const row = await prisma.albumSection.update({
      where: { id: sectionId },
      data: parsed.data,
    });

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "UPDATE",
      entity: "AlbumSection",
      entityId: sectionId,
      before: { title: before.title, enabled: before.enabled },
      after: { title: row.title, enabled: row.enabled },
    });

    return NextResponse.json({
      data: { ...row, imageUrl: row.imageUrl ? ossSignIfOurs(row.imageUrl) : null },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; sectionId: string }> },
) {
  const { familyId, sectionId } = await ctx.params;
  try {
    const auth = await requireFamilyWrite(familyId);
    const row = await prisma.albumSection.findFirst({
      where: { id: sectionId, familyId },
    });
    if (!row) return notFound("章节不存在");
    if (!canDeleteKind(row.kind)) {
      return forbidden("SECTION_NOT_DELETABLE", "系统章节只能关闭，不能删除");
    }

    await prisma.albumSection.delete({ where: { id: sectionId } });
    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "DELETE",
      entity: "AlbumSection",
      entityId: sectionId,
      before: { kind: row.kind, title: row.title },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (e) {
    return handleApiError(e);
  }
}
