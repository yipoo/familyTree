/**
 * 采集链接：停用（软撤销）
 *
 *   DELETE   置 revokedAt，使二维码立即失效（保留记录便于审计）
 *
 * 权限：requireFamilyWrite。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, notFound } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; id: string }> },
) {
  const { familyId, id } = await ctx.params;
  try {
    const auth = await requireFamilyWrite(familyId);
    const link = await prisma.collectionLink.findFirst({ where: { id, familyId } });
    if (!link) return notFound("采集链接不存在");
    if (!link.revokedAt) {
      await prisma.collectionLink.update({ where: { id }, data: { revokedAt: new Date() } });
      await writeAudit({
        familyId,
        actorId: auth.user.id,
        kind: "DELETE",
        entity: "CollectionLink",
        entityId: id,
      });
    }
    return NextResponse.json({ data: { revoked: true } });
  } catch (e) {
    return handleApiError(e);
  }
}
