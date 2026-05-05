/**
 * 权限守卫
 *
 * 三层模型：
 *   1. PlatformRole.SUPERADMIN  跨家族超级管理员
 *   2. FamilyMember.role        家族级 OWNER / ADMIN / MEMBER / GUEST
 *   3. SubtreeAdmin             给某用户授予「某人 + 父系后代」的写权限
 *
 * 写人物：requireWriteOnPerson()
 *   - SUPERADMIN ✅
 *   - 家族 OWNER / ADMIN ✅
 *   - 该 person 的父系链上某祖先（含自己）被授予 SubtreeAdmin ✅
 *   - 否则 ❌（MEMBER 走待审，二期）
 *
 * 过继：祖先链按 ParentChild.isPrimary=true 边走（含 ADOPTED 等非生物关系）。
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { FamilyRole, PlatformRole } from "@/lib/generated/prisma/enums";

export class AuthError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type SessionUser = {
  id: string;
  phone: string | null;
  name: string;
  platformRole: PlatformRole;
};

const ROLE_RANK: Record<FamilyRole, number> = {
  GUEST: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

// ------------------------------------------------------------------
// 基础：当前会话
// ------------------------------------------------------------------

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new AuthError(401, "UNAUTHENTICATED", "请先登录");

  // session 里没存 platformRole，按需查询（一次主键查询，可接受）
  const u = await prisma.user.findUnique({
    where: { id },
    select: { platformRole: true },
  });
  if (!u) throw new AuthError(401, "UNAUTHENTICATED", "用户不存在");

  return {
    id,
    phone: session.user.phone ?? null,
    name: session.user.name,
    platformRole: u.platformRole,
  };
}

export async function requirePlatformRole(
  role: PlatformRole = "SUPERADMIN",
): Promise<SessionUser> {
  const u = await requireUser();
  if (u.platformRole !== role) {
    throw new AuthError(403, "FORBIDDEN", "需要平台管理员权限");
  }
  return u;
}

// ------------------------------------------------------------------
// 家族级：读
// ------------------------------------------------------------------

export type FamilyContext = {
  user: SessionUser;
  familyId: string;
  /** 若来自 FamilyMember 则为该角色；SUPERADMIN 直通时为 null */
  role: FamilyRole | null;
};

export async function requireFamilyRole(
  familyId: string,
  minRole: FamilyRole = "MEMBER",
): Promise<FamilyContext> {
  const user = await requireUser();
  if (user.platformRole === "SUPERADMIN") {
    return { user, familyId, role: null };
  }

  const m = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId: user.id, familyId } },
    select: { role: true },
  });
  if (!m) throw new AuthError(403, "FORBIDDEN", "无权访问该家族");
  if (ROLE_RANK[m.role] < ROLE_RANK[minRole]) {
    throw new AuthError(403, "FORBIDDEN", "权限不足");
  }
  return { user, familyId, role: m.role };
}

// ------------------------------------------------------------------
// 家族级：写（家族范围操作 —— 字辈、邀请成员、家族元数据等）
// ------------------------------------------------------------------

export async function requireFamilyWrite(familyId: string): Promise<FamilyContext> {
  return requireFamilyRole(familyId, "ADMIN");
}

// ------------------------------------------------------------------
// 子树级：写人物
// ------------------------------------------------------------------

const MAX_ANCESTOR_DEPTH = 64;

/**
 * 取得某 person 的父系祖先 id 列表（含自己）。
 * 沿 ParentChild.isPrimary=true 且 parent.gender=MALE 的边上溯。
 * 嫁入女性视为根（不再上溯）。
 */
export async function getPaternalAncestors(personId: string): Promise<string[]> {
  const chain: string[] = [];
  const seen = new Set<string>();
  let cur: string | null = personId;
  let depth = 0;
  while (cur && !seen.has(cur) && depth < MAX_ANCESTOR_DEPTH) {
    seen.add(cur);
    chain.push(cur);
    const me = await prisma.person.findUnique({
      where: { id: cur },
      select: { isMarriedIn: true, gender: true },
    });
    if (!me) break;
    if (me.isMarriedIn) break; // 嫁入女性的子树权限不再追上层
    const pc: { parentId: string } | null = await prisma.parentChild.findFirst({
      where: { childId: cur, isPrimary: true, parent: { gender: "MALE" } },
      select: { parentId: true },
    });
    cur = pc?.parentId ?? null;
    depth++;
  }
  return chain;
}

/**
 * 当前用户能否写入指定 person。
 * 不抛错，返回布尔；UI / 菜单可见性使用此版本。
 *
 * 实际判定逻辑在 lib/auth/subtree.ts:judgeSubtreeWrite —— 与本函数一一对应，
 * 但使用纯邻接表 + 标记 map 作为输入，便于 vitest 单测覆盖。
 */
export async function canWriteOnPerson(
  user: SessionUser,
  familyId: string,
  personId: string,
): Promise<boolean> {
  if (user.platformRole === "SUPERADMIN") return true;

  const m = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId: user.id, familyId } },
    select: { role: true },
  });
  if (m && (m.role === "OWNER" || m.role === "ADMIN")) return true;

  // 检查 SubtreeAdmin：祖先链与授权根求交集
  const grants = await prisma.subtreeAdmin.findMany({
    where: { userId: user.id, familyId },
    select: { rootPersonId: true },
  });
  if (grants.length === 0) return false;

  const rootSet = new Set(grants.map((g) => g.rootPersonId));
  const chain = await getPaternalAncestors(personId);
  return chain.some((a) => rootSet.has(a));
}

export async function requireWriteOnPerson(
  familyId: string,
  personId: string,
): Promise<FamilyContext> {
  const user = await requireUser();
  const ok = await canWriteOnPerson(user, familyId, personId);
  if (!ok) throw new AuthError(403, "FORBIDDEN", "无权修改该人物");

  const m =
    user.platformRole === "SUPERADMIN"
      ? null
      : (
          await prisma.familyMember.findUnique({
            where: { userId_familyId: { userId: user.id, familyId } },
            select: { role: true },
          })
        )?.role ?? null;
  return { user, familyId, role: m };
}

// ------------------------------------------------------------------
// Error → Response 适配
// ------------------------------------------------------------------

export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status },
    );
  }
  throw err;
}
