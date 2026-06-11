/**
 * PATCH /api/families/[familyId]/join-requests/[id]
 *
 * action:
 *   approve / reject  族长 / 管理员（requireFamilyWrite）批准或拒绝
 *   cancel            申请人自己撤回（仅 PENDING、且 userId 必须本人）
 *
 * 批准：在事务里把 JoinRequest 标 APPROVED + 创建 FamilyMember(role=MEMBER)
 *       已是成员则跳过创建，仅推进状态（避免唯一键冲突）。
 * 拒绝 / 撤回：只更新状态。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyWrite, requireUser } from "@/lib/auth/guard";
import { FamilyRole } from "@/lib/generated/prisma/enums";
import {
  badRequest,
  forbidden,
  handleApiError,
  notFound,
  readJson,
  zodError,
} from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const DecideSchema = z.object({
  action: z.enum(["approve", "reject", "cancel"]),
  note: z.string().trim().max(200).optional().nullable(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ familyId: string; id: string }> },
) {
  const { familyId, id } = await ctx.params;
  try {
    const json = await readJson<unknown>(req);
    const parsed = DecideSchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);
    const { action, note } = parsed.data;

    const before = await prisma.joinRequest.findFirst({
      where: { id, familyId },
    });
    if (!before) return notFound("申请不存在");
    if (before.status !== "PENDING") {
      return badRequest(
        "ALREADY_DECIDED",
        `申请状态为 ${before.status}，无需再处理`,
      );
    }

    // 鉴权按 action 分发
    let actorId: string;
    if (action === "cancel") {
      const me = await requireUser();
      if (me.id !== before.userId) {
        return forbidden("NOT_APPLICANT", "只有申请人本人可撤回该申请");
      }
      actorId = me.id;
    } else {
      const auth = await requireFamilyWrite(familyId);
      actorId = auth.user.id;
    }

    if (action === "cancel") {
      const after = await prisma.joinRequest.update({
        where: { id },
        data: {
          status: "CANCELLED",
          decidedAt: new Date(),
          decidedById: actorId,
          decidedNote: note?.trim() || null,
        },
      });
      // 不写 AuditLog —— cancel 是申请人自己的动作，不属于族内操作流
      return NextResponse.json({ data: after });
    }

    if (action === "approve") {
      const after = await prisma.$transaction(async (tx) => {
        const updated = await tx.joinRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            decidedAt: new Date(),
            decidedById: actorId,
            decidedNote: note?.trim() || null,
          },
        });
        // 已是成员则不再重复创建（防唯一键冲突）
        const existed = await tx.familyMember.findUnique({
          where: { userId_familyId: { userId: before.userId, familyId } },
          select: { id: true },
        });
        if (!existed) {
          await tx.familyMember.create({
            data: {
              userId: before.userId,
              familyId,
              role: FamilyRole.MEMBER,
            },
          });
        }
        return updated;
      });
      await writeAudit({
        familyId,
        actorId: actorId,
        kind: "APPROVE",
        entity: "JoinRequest",
        entityId: id,
        before,
        after,
      });
      return NextResponse.json({ data: after });
    }

    // reject
    const after = await prisma.joinRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        decidedAt: new Date(),
        decidedById: actorId,
        decidedNote: note?.trim() || null,
      },
    });
    await writeAudit({
      familyId,
      actorId: actorId,
      kind: "REJECT",
      entity: "JoinRequest",
      entityId: id,
      before,
      after,
    });
    return NextResponse.json({ data: after });
  } catch (e) {
    return handleApiError(e);
  }
}
