/**
 * 小程序鉴权 / 访问控制。
 *
 * - requireSession：校验 Bearer session token → { userId, openid }
 * - resolveMyPositions：手机号哈希匹配出"我的位置"（跨家族，每家族一个）
 * - accessibleFamilyIds：可访问家族 = 正式成员 ∪ 手机号匹配到节点的家族
 *
 * 「仅成员可见」：未匹配/非成员看不到任何家族数据（canAccessFamily=false）。
 */
import { prisma } from "@/lib/db";
import { readBearer, type MiniappClaims } from "@/lib/services/miniapp-token";
import { hashPhone } from "@/lib/services/phone";
import { matchPositions, type MatchedPosition } from "@/lib/services/miniapp-bind";

export function requireSession(req: Request): MiniappClaims | null {
  const c = readBearer(req);
  if (!c || c.kind !== "session" || !c.userId) return null;
  return c;
}

export async function resolveMyPositions(userId: string): Promise<MatchedPosition[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });
  const h = user?.phone ? hashPhone(user.phone) : null;
  if (!h) return [];
  const persons = await prisma.person.findMany({
    where: { contactPhoneHash: h, deletedAt: null },
    select: {
      id: true,
      name: true,
      generation: true,
      familyId: true,
      family: { select: { name: true } },
    },
  });
  return matchPositions(
    persons.map((p) => ({
      familyId: p.familyId,
      familyName: p.family.name,
      personId: p.id,
      personName: p.name,
      generation: p.generation,
      contactPhoneHash: h,
    })),
    h,
  );
}

export async function accessibleFamilyIds(userId: string): Promise<Set<string>> {
  const [members, positions] = await Promise.all([
    prisma.familyMember.findMany({ where: { userId }, select: { familyId: true } }),
    resolveMyPositions(userId),
  ]);
  const s = new Set<string>();
  members.forEach((m) => s.add(m.familyId));
  positions.forEach((p) => s.add(p.familyId));
  return s;
}

export async function canAccessFamily(userId: string, familyId: string): Promise<boolean> {
  return (await accessibleFamilyIds(userId)).has(familyId);
}
