/**
 * PATCH  /api/families/[familyId]/members/[userId]    改角色（含转让 OWNER）
 * DELETE /api/families/[familyId]/members/[userId]    移除成员（同时撤掉 SubtreeAdmin）
 *
 * OWNER 角色变更只允许：当前 OWNER 自己 / SUPERADMIN。
 * 不允许把唯一的 OWNER 降级，需先转让。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, badRequest, notFound, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";
import type { FamilyRole } from "@/lib/generated/prisma/enums";

const PatchSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "GUEST"]),
  /** 仅当 role=OWNER 时生效：把当前 OWNER 顺位降为该角色（默认 ADMIN） */
  demoteCurrentOwnerTo: z.enum(["ADMIN", "MEMBER"]).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ familyId: string; userId: string }> },
) {
  const { familyId, userId } = await ctx.params;
  try {
    const auth = await requireFamilyWrite(familyId);
    const json = await readJson<unknown>(req);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);
    const newRole = parsed.data.role as FamilyRole;

    const target = await prisma.familyMember.findUnique({
      where: { userId_familyId: { userId, familyId } },
    });
    if (!target) return notFound("成员不存在");

    // OWNER 操作约束
    if (
      (target.role === "OWNER" || newRole === "OWNER") &&
      auth.role !== "OWNER" &&
      auth.user.platformRole !== "SUPERADMIN"
    ) {
      return badRequest("FORBIDDEN", "只有族长或超管可调整族长角色");
    }

    if (target.role === "OWNER" && newRole !== "OWNER") {
      const ownerCount = await prisma.familyMember.count({
        where: { familyId, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        return badRequest("LAST_OWNER", "至少保留一位族长，请先转让");
      }
    }

    // 转让 OWNER：把现有 OWNER 降级
    if (newRole === "OWNER") {
      const demoteTo = (parsed.data.demoteCurrentOwnerTo ?? "ADMIN") as FamilyRole;
      await prisma.$transaction(async (tx) => {
        await tx.familyMember.updateMany({
          where: { familyId, role: "OWNER", userId: { not: userId } },
          data: { role: demoteTo },
        });
        await tx.familyMember.update({
          where: { userId_familyId: { userId, familyId } },
          data: { role: "OWNER" },
        });
        await tx.family.update({
          where: { id: familyId },
          data: { ownerId: userId },
        });
      });
    } else {
      await prisma.familyMember.update({
        where: { userId_familyId: { userId, familyId } },
        data: { role: newRole },
      });
    }

    const after = await prisma.familyMember.findUnique({
      where: { userId_familyId: { userId, familyId } },
    });

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "UPDATE",
      entity: "FamilyMember",
      entityId: `${userId}::${familyId}`,
      before: target,
      after,
    });

    return NextResponse.json({ data: after });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; userId: string }> },
) {
  const { familyId, userId } = await ctx.params;
  try {
    const auth = await requireFamilyWrite(familyId);
    const target = await prisma.familyMember.findUnique({
      where: { userId_familyId: { userId, familyId } },
    });
    if (!target) return notFound("成员不存在");
    if (target.role === "OWNER") {
      return badRequest("CANNOT_REMOVE_OWNER", "不能直接移除族长，请先转让");
    }
    if (
      target.role === "ADMIN" &&
      auth.role !== "OWNER" &&
      auth.user.platformRole !== "SUPERADMIN"
    ) {
      return badRequest("FORBIDDEN", "管理员只能由族长或超管移除");
    }

    await prisma.$transaction([
      prisma.subtreeAdmin.deleteMany({ where: { userId, familyId } }),
      prisma.familyMember.delete({
        where: { userId_familyId: { userId, familyId } },
      }),
    ]);

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "DELETE",
      entity: "FamilyMember",
      entityId: `${userId}::${familyId}`,
      before: target,
    });

    return NextResponse.json({ data: { userId, deleted: true } });
  } catch (e) {
    return handleApiError(e);
  }
}
