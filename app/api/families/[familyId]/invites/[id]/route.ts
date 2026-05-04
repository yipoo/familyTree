/**
 * DELETE /api/families/[familyId]/invites/[id]    撤销邀请码（保留行，置 revokedAt）
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
    const inv = await prisma.familyInvite.findUnique({ where: { id } });
    if (!inv || inv.familyId !== familyId) return notFound("邀请码不存在");
    if (inv.revokedAt) return NextResponse.json({ data: { id, revoked: true } });

    const updated = await prisma.familyInvite.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "DELETE",
      entity: "FamilyInvite",
      entityId: id,
      before: inv,
      after: updated,
    });

    return NextResponse.json({ data: { id, revoked: true } });
  } catch (e) {
    return handleApiError(e);
  }
}
