/**
 * 小程序：人物详情（只读）—— 基本信息 + 父母/配偶/子女 + 相册
 *   GET (Bearer session)
 *
 * 不返回敏感字段（如他人手机号哈希）。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireSession, canAccessFamily } from "@/lib/auth/miniapp";
import { ossSignIfOurs } from "@/lib/services/oss";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string; personId: string }> },
) {
  const { familyId, personId } = await ctx.params;
  const claims = requireSession(req);
  if (!claims) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "请先登录" } }, { status: 401 });
  }
  if (!(await canAccessFamily(claims.userId!, familyId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问该家族" } }, { status: 403 });
  }

  const person = await prisma.person.findFirst({
    where: { id: personId, familyId, deletedAt: null },
    select: {
      id: true, name: true, alias: true, gender: true, generation: true, generationChar: true,
      birthOrder: true, birthYear: true, deathYear: true, birthPlace: true, status: true,
      avatarUrl: true, biography: true, isMarriedIn: true,
    },
  });
  if (!person) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "人物不存在" } }, { status: 404 });
  }

  const [parentRels, marriages, childRels, media] = await Promise.all([
    prisma.parentChild.findMany({ where: { childId: personId, familyId }, select: { parent: { select: { id: true, name: true, gender: true } } } }),
    prisma.marriage.findMany({
      where: { familyId, OR: [{ husbandId: personId }, { wifeId: personId }] },
      select: { type: true, husband: { select: { id: true, name: true } }, wife: { select: { id: true, name: true } } },
      orderBy: { order: "asc" },
    }),
    prisma.parentChild.findMany({
      where: { parentId: personId, familyId },
      select: { child: { select: { id: true, name: true, gender: true } } },
      orderBy: { child: { birthOrder: "asc" } },
    }),
    prisma.media.findMany({
      where: { familyId, personId, kind: "PHOTO" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, url: true, caption: true },
    }),
  ]);

  return NextResponse.json({
    data: {
      person: { ...person, avatarUrl: ossSignIfOurs(person.avatarUrl) },
      parents: parentRels.map((r) => r.parent),
      spouses: marriages.map((m) => ({
        ...(m.husband.id === personId ? m.wife : m.husband),
        type: m.type,
      })),
      children: childRels.map((r) => r.child),
      photos: media.map((m) => ({ ...m, url: ossSignIfOurs(m.url) })),
    },
  });
}
