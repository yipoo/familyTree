/**
 * 五服图数据
 *
 *   GET ?root=<personId>   以某人为「己」，返回其本宗五服亲属 + 服制
 *
 * 读权限：家族成员（MEMBER+）。纯计算见 lib/services/wufu.ts。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireFamilyRole } from "@/lib/auth/guard";
import { handleApiError, badRequest, notFound } from "@/lib/api/error";
import { computeWufu } from "@/lib/services/wufu";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");

    const root = new URL(req.url).searchParams.get("root");
    if (!root) return badRequest("VALIDATION_FAILED", "缺少 root 参数");

    const target = await prisma.person.findFirst({
      where: { id: root, familyId, deletedAt: null },
      select: { id: true },
    });
    if (!target) return notFound("人物不存在");

    const [persons, parentChild, marriages] = await Promise.all([
      prisma.person.findMany({
        where: { familyId, deletedAt: null },
        select: { id: true, name: true, gender: true, birthYear: true, birthOrder: true },
      }),
      prisma.parentChild.findMany({
        where: { familyId },
        select: { parentId: true, childId: true, isPrimary: true },
      }),
      prisma.marriage.findMany({
        where: { familyId },
        select: { husbandId: true, wifeId: true },
      }),
    ]);

    const chart = computeWufu({ rootPersonId: root, persons, parentChild, marriages });
    if (!chart) return notFound("无法生成五服图");

    return NextResponse.json({ data: chart });
  } catch (e) {
    return handleApiError(e);
  }
}
