/**
 * DELETE /api/families/[familyId]/share-links/[id]   撤销（直接删除）分享链接
 * PATCH  /api/families/[familyId]/share-links/[id]   修改有效期 / 密码 / scope
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, notFound, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const PatchSchema = z.object({
  ttl: z.enum(["1d", "7d", "30d", "180d", "never"]).optional(),
  scope: z
    .union([
      z.object({ kind: z.literal("all") }),
      z.object({ kind: z.literal("subtree"), rootPersonId: z.string().min(1) }),
    ])
    .optional(),
  /**
   * password:
   *   - 字符串 → 重设密码
   *   - null   → 移除密码
   *   - undefined → 不动
   */
  password: z.string().min(4).max(64).nullable().optional(),
});

const TTL_MAP: Record<string, number | null> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "180d": 180,
  never: null,
};

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; id: string }> },
) {
  const { familyId, id } = await ctx.params;
  try {
    const ctxAuth = await requireFamilyWrite(familyId);
    const link = await prisma.shareLink.findUnique({
      where: { id },
      select: { id: true, familyId: true, token: true, scope: true },
    });
    if (!link || link.familyId !== familyId) return notFound("分享链接不存在");
    await prisma.shareLink.delete({ where: { id } });
    await writeAudit({
      familyId,
      actorId: ctxAuth.user.id,
      kind: "DELETE",
      entity: "ShareLink",
      entityId: id,
      before: { token: link.token, scope: link.scope },
    });
    return NextResponse.json({ data: { id, deleted: true } });
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
    const ctxAuth = await requireFamilyWrite(familyId);
    const json = await readJson<unknown>(req);
    const parsed = PatchSchema.safeParse(json ?? {});
    if (!parsed.success) return zodError(parsed.error);

    const link = await prisma.shareLink.findUnique({ where: { id } });
    if (!link || link.familyId !== familyId) return notFound("分享链接不存在");

    const data: Record<string, unknown> = {};
    if (parsed.data.ttl !== undefined) {
      const days = TTL_MAP[parsed.data.ttl];
      data.expiresAt = days === null ? null : new Date(Date.now() + days * 86400000);
    }
    if (parsed.data.scope !== undefined) {
      if (parsed.data.scope.kind === "subtree") {
        const root = await prisma.person.findFirst({
          where: {
            id: parsed.data.scope.rootPersonId,
            familyId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!root) return notFound("rootPersonId 不属于该家族");
      }
      data.scope = parsed.data.scope;
    }
    if (parsed.data.password !== undefined) {
      data.passwordHash = parsed.data.password
        ? await hashPassword(parsed.data.password)
        : null;
    }

    const updated = await prisma.shareLink.update({ where: { id }, data });

    await writeAudit({
      familyId,
      actorId: ctxAuth.user.id,
      kind: "UPDATE",
      entity: "ShareLink",
      entityId: id,
      before: {
        scope: link.scope,
        expiresAt: link.expiresAt,
        hasPassword: !!link.passwordHash,
      },
      after: {
        scope: updated.scope,
        expiresAt: updated.expiresAt,
        hasPassword: !!updated.passwordHash,
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        token: updated.token,
        scope: updated.scope,
        expiresAt: updated.expiresAt,
        hasPassword: !!updated.passwordHash,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
