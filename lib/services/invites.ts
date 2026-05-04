/**
 * 家族邀请码（FamilyInvite）服务。
 *
 * 码格式：8 位 base32 友好字符（去除易混 0/O/1/I/L），分组显示为 XXXX-XXXX。
 * - 数据库存的是 8 位连续大写串
 * - 用户输入时容忍小写、空格、连字符
 */
import { prisma } from "@/lib/db";
import type { FamilyRole } from "@/lib/generated/prisma/enums";
import {
  formatInviteCode,
  generateInviteCode,
  normalizeInviteCode,
} from "@/lib/services/invite-format";

const CODE_LEN = 8;

export { formatInviteCode, generateInviteCode, normalizeInviteCode };

export type InviteValidation =
  | { ok: true; invite: ResolvedInvite }
  | {
      ok: false;
      reason: "not_found" | "revoked" | "expired" | "exhausted";
    };

export type ResolvedInvite = {
  id: string;
  familyId: string;
  code: string;
  role: FamilyRole;
  family: { id: string; name: string; surname: string; description: string | null };
  createdByName: string;
  remainingUses: number | null; // null = 无限
};

export async function validateInvite(rawCode: string): Promise<InviteValidation> {
  const code = normalizeInviteCode(rawCode);
  if (code.length < CODE_LEN) return { ok: false, reason: "not_found" };

  const inv = await prisma.familyInvite.findUnique({
    where: { code },
    include: {
      family: {
        select: { id: true, name: true, surname: true, description: true, deletedAt: true },
      },
      createdBy: { select: { name: true } },
    },
  });
  if (!inv || inv.family.deletedAt) return { ok: false, reason: "not_found" };
  if (inv.revokedAt) return { ok: false, reason: "revoked" };
  if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (inv.maxUses !== null && inv.uses >= inv.maxUses) {
    return { ok: false, reason: "exhausted" };
  }

  return {
    ok: true,
    invite: {
      id: inv.id,
      familyId: inv.familyId,
      code: inv.code,
      role: inv.role,
      family: {
        id: inv.family.id,
        name: inv.family.name,
        surname: inv.family.surname,
        description: inv.family.description,
      },
      createdByName: inv.createdBy.name,
      remainingUses:
        inv.maxUses === null ? null : Math.max(0, inv.maxUses - inv.uses),
    },
  };
}

/**
 * 凭码加入家族。原子操作：
 *   - 校验码可用
 *   - 已是成员 → 直接 ok（幂等）
 *   - 否则：upsert FamilyMember + 写 FamilyInviteUse + uses += 1
 */
export type ConsumeReason =
  | "not_found"
  | "revoked"
  | "expired"
  | "exhausted";

export async function consumeInvite(
  rawCode: string,
  userId: string,
): Promise<
  | { ok: true; familyId: string; alreadyMember: boolean; role: FamilyRole }
  | { ok: false; reason: ConsumeReason }
> {
  const v = await validateInvite(rawCode);
  if (!v.ok) return v;

  const { invite } = v;

  const existing = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId, familyId: invite.familyId } },
    select: { role: true },
  });
  if (existing) {
    return {
      ok: true,
      familyId: invite.familyId,
      alreadyMember: true,
      role: existing.role,
    };
  }

  // 事务：再次校验剩余次数（防并发）+ 写记录
  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.familyInvite.findUnique({
        where: { id: invite.id },
        select: { maxUses: true, uses: true, revokedAt: true, expiresAt: true },
      });
      if (!fresh) throw new Error("RACE");
      if (fresh.revokedAt) throw new Error("RACE");
      if (fresh.expiresAt && fresh.expiresAt.getTime() < Date.now()) {
        throw new Error("RACE");
      }
      if (fresh.maxUses !== null && fresh.uses >= fresh.maxUses) {
        throw new Error("RACE");
      }
      await tx.familyMember.create({
        data: { userId, familyId: invite.familyId, role: invite.role },
      });
      await tx.familyInviteUse.create({
        data: { inviteId: invite.id, userId },
      });
      await tx.familyInvite.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "RACE") {
      return { ok: false, reason: "exhausted" };
    }
    throw e;
  }

  return {
    ok: true,
    familyId: invite.familyId,
    alreadyMember: false,
    role: invite.role,
  };
}
