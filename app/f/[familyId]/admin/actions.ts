"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireFamilyWrite, requireUser } from "@/lib/auth/guard";
import { normalizePhone } from "@/lib/auth/password";
import { generateShareToken, type ShareScope } from "@/lib/auth/share";
import { generateInviteCode } from "@/lib/services/invites";
import type { FamilyRole } from "@/lib/generated/prisma/enums";

type Result = { ok?: true; error?: string };

const ASSIGNABLE_ROLES: FamilyRole[] = ["ADMIN", "MEMBER", "GUEST"];

// ------------------------------------------------------------------
// 成员管理
// ------------------------------------------------------------------

/**
 * 通过手机号邀请成员加入家族。
 * - 用户必须已注册（手机号匹配）。
 * - 角色限定 ADMIN / MEMBER / GUEST（OWNER 不通过邀请，只能转让）。
 */
export async function inviteMember(
  familyId: string,
  _prev: Result | undefined,
  formData: FormData,
): Promise<Result> {
  try {
    await requireFamilyWrite(familyId);
  } catch {
    return { error: "权限不足" };
  }

  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const roleRaw = String(formData.get("role") ?? "MEMBER") as FamilyRole;
  if (!phone) return { error: "手机号格式不正确" };
  if (!ASSIGNABLE_ROLES.includes(roleRaw)) return { error: "角色不合法" };

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return { error: "该手机号尚未注册，请先让对方注册账号" };

  await prisma.familyMember.upsert({
    where: { userId_familyId: { userId: user.id, familyId } },
    update: { role: roleRaw },
    create: { userId: user.id, familyId, role: roleRaw },
  });

  revalidatePath(`/f/${familyId}/admin`);
  return { ok: true };
}

export async function changeMemberRole(
  familyId: string,
  formData: FormData,
): Promise<Result> {
  try {
    const ctx = await requireFamilyWrite(familyId);
    const targetUserId = String(formData.get("userId") ?? "");
    const newRole = String(formData.get("role") ?? "") as FamilyRole;
    if (!ASSIGNABLE_ROLES.includes(newRole) && newRole !== "OWNER") {
      return { error: "角色不合法" };
    }

    const target = await prisma.familyMember.findUnique({
      where: { userId_familyId: { userId: targetUserId, familyId } },
      select: { role: true },
    });
    if (!target) return { error: "成员不存在" };

    // OWNER 角色操作只允许 OWNER 自身或 SUPERADMIN
    if (
      (target.role === "OWNER" || newRole === "OWNER") &&
      ctx.role !== "OWNER" &&
      ctx.user.platformRole !== "SUPERADMIN"
    ) {
      return { error: "只有族长本人或超管可以改动族长角色" };
    }

    // 不允许把唯一的 OWNER 降级（必须先转让）
    if (target.role === "OWNER" && newRole !== "OWNER") {
      const ownerCount = await prisma.familyMember.count({
        where: { familyId, role: "OWNER" },
      });
      if (ownerCount <= 1) return { error: "至少保留一位族长，请先转让" };
    }

    await prisma.familyMember.update({
      where: { userId_familyId: { userId: targetUserId, familyId } },
      data: { role: newRole },
    });
    revalidatePath(`/f/${familyId}/admin`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
}

export async function removeMember(
  familyId: string,
  formData: FormData,
): Promise<Result> {
  try {
    const ctx = await requireFamilyWrite(familyId);
    const targetUserId = String(formData.get("userId") ?? "");
    const target = await prisma.familyMember.findUnique({
      where: { userId_familyId: { userId: targetUserId, familyId } },
      select: { role: true },
    });
    if (!target) return { error: "成员不存在" };
    if (target.role === "OWNER") {
      return { error: "不能直接移除族长，请先转让" };
    }
    if (
      target.role === "ADMIN" &&
      ctx.role !== "OWNER" &&
      ctx.user.platformRole !== "SUPERADMIN"
    ) {
      return { error: "管理员只能由族长或超管移除" };
    }

    // 同时撤掉该用户在本家族的所有 SubtreeAdmin
    await prisma.$transaction([
      prisma.subtreeAdmin.deleteMany({ where: { userId: targetUserId, familyId } }),
      prisma.familyMember.delete({
        where: { userId_familyId: { userId: targetUserId, familyId } },
      }),
    ]);
    revalidatePath(`/f/${familyId}/admin`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
}

// ------------------------------------------------------------------
// 子树管理员授权
// ------------------------------------------------------------------

export async function grantSubtree(
  familyId: string,
  _prev: Result | undefined,
  formData: FormData,
): Promise<Result> {
  try {
    const ctx = await requireFamilyWrite(familyId);
    const userId = String(formData.get("userId") ?? "");
    const rootPersonId = String(formData.get("rootPersonId") ?? "");
    const note = String(formData.get("note") ?? "").trim() || null;

    if (!userId || !rootPersonId) return { error: "请选择用户和人物" };

    // 校验：被授权用户必须是该家族成员
    const m = await prisma.familyMember.findUnique({
      where: { userId_familyId: { userId, familyId } },
      select: { role: true },
    });
    if (!m) return { error: "对方还不是该家族成员，请先邀请" };

    // 校验：rootPerson 属于该家族
    const root = await prisma.person.findFirst({
      where: { id: rootPersonId, familyId, deletedAt: null },
      select: { id: true },
    });
    if (!root) return { error: "人物不属于该家族" };

    await prisma.subtreeAdmin.upsert({
      where: { userId_rootPersonId: { userId, rootPersonId } },
      update: { note, grantedById: ctx.user.id },
      create: {
        userId,
        familyId,
        rootPersonId,
        grantedById: ctx.user.id,
        note,
      },
    });
    revalidatePath(`/f/${familyId}/admin`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
}

export async function revokeSubtree(
  familyId: string,
  formData: FormData,
): Promise<Result> {
  try {
    await requireFamilyWrite(familyId);
    const grantId = String(formData.get("grantId") ?? "");
    const grant = await prisma.subtreeAdmin.findUnique({
      where: { id: grantId },
      select: { familyId: true },
    });
    if (!grant || grant.familyId !== familyId) return { error: "记录不存在" };
    await prisma.subtreeAdmin.delete({ where: { id: grantId } });
    revalidatePath(`/f/${familyId}/admin`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
}

// ------------------------------------------------------------------
// 分享链接
// ------------------------------------------------------------------

const VALID_TTL: Record<string, number | null> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "180d": 180,
  never: null,
};

export async function createShareLink(
  familyId: string,
  _prev: Result | undefined,
  formData: FormData,
): Promise<Result> {
  try {
    const ctx = await requireFamilyWrite(familyId);
    const ttlKey = String(formData.get("ttl") ?? "30d");
    const days = ttlKey in VALID_TTL ? VALID_TTL[ttlKey] : 30;
    const expiresAt = days === null ? null : new Date(Date.now() + days * 86400000);

    const scope: ShareScope = { kind: "all" };
    await prisma.shareLink.create({
      data: {
        familyId,
        token: generateShareToken(),
        scope,
        expiresAt,
        createdBy: ctx.user.id,
      },
    });
    revalidatePath(`/f/${familyId}/admin`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
}

export async function revokeShareLink(
  familyId: string,
  formData: FormData,
): Promise<Result> {
  try {
    await requireFamilyWrite(familyId);
    const id = String(formData.get("id") ?? "");
    const link = await prisma.shareLink.findUnique({
      where: { id },
      select: { familyId: true },
    });
    if (!link || link.familyId !== familyId) return { error: "记录不存在" };
    await prisma.shareLink.delete({ where: { id } });
    revalidatePath(`/f/${familyId}/admin`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
}

// ------------------------------------------------------------------
// 邀请码
// ------------------------------------------------------------------

const INVITE_TTL: Record<string, number | null> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "180d": 180,
  never: null,
};

const ASSIGNABLE_INVITE_ROLES: FamilyRole[] = ["ADMIN", "MEMBER", "GUEST"];

export async function createInvite(
  familyId: string,
  _prev: Result | undefined,
  formData: FormData,
): Promise<Result> {
  try {
    const ctx = await requireFamilyWrite(familyId);
    const role = String(formData.get("role") ?? "MEMBER") as FamilyRole;
    if (!ASSIGNABLE_INVITE_ROLES.includes(role)) return { error: "角色不合法" };

    const ttlKey = String(formData.get("ttl") ?? "30d");
    const days = ttlKey in INVITE_TTL ? INVITE_TTL[ttlKey] : 30;
    const expiresAt = days === null ? null : new Date(Date.now() + days * 86400000);

    const usesKey = String(formData.get("uses") ?? "many");
    const maxUses = usesKey === "1" ? 1 : usesKey === "10" ? 10 : null;

    const note = String(formData.get("note") ?? "").trim() || null;

    // 不太可能撞，但留个简单重试
    let attempts = 0;
    while (attempts < 5) {
      try {
        await prisma.familyInvite.create({
          data: {
            familyId,
            code: generateInviteCode(),
            role,
            maxUses,
            expiresAt,
            note,
            createdById: ctx.user.id,
          },
        });
        break;
      } catch (e) {
        if (
          e instanceof Error &&
          /Unique constraint/.test(e.message) &&
          attempts < 4
        ) {
          attempts++;
          continue;
        }
        throw e;
      }
    }

    revalidatePath(`/f/${familyId}/admin`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
}

export async function revokeInvite(
  familyId: string,
  formData: FormData,
): Promise<Result> {
  try {
    await requireFamilyWrite(familyId);
    const id = String(formData.get("id") ?? "");
    const inv = await prisma.familyInvite.findUnique({
      where: { id },
      select: { familyId: true, revokedAt: true },
    });
    if (!inv || inv.familyId !== familyId) return { error: "记录不存在" };
    if (inv.revokedAt) return { ok: true };
    await prisma.familyInvite.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    revalidatePath(`/f/${familyId}/admin`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
}

// ------------------------------------------------------------------
// 当前用户对该家族是否有 admin 后台权限（页面入口判定）
// ------------------------------------------------------------------

export async function canManageFamily(familyId: string): Promise<boolean> {
  try {
    const u = await requireUser();
    if (u.platformRole === "SUPERADMIN") return true;
    const m = await prisma.familyMember.findUnique({
      where: { userId_familyId: { userId: u.id, familyId } },
      select: { role: true },
    });
    return m?.role === "OWNER" || m?.role === "ADMIN";
  } catch {
    return false;
  }
}
