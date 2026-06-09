/**
 * 数据体检 / 智能纠错
 *
 *   GET   全族一致性检查，返回问题清单（error / warning / info）
 *
 * 权限：requireFamilyWrite（族长 / 管理员）。纯算法见 lib/services/data-check.ts。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError } from "@/lib/api/error";
import { checkFamilyData } from "@/lib/services/data-check";

export async function GET(_req: Request, ctx: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyWrite(familyId);

    const [persons, parentChild, marriages] = await Promise.all([
      prisma.person.findMany({
        where: { familyId, deletedAt: null },
        select: { id: true, name: true, gender: true, generation: true, birthYear: true, deathYear: true },
      }),
      prisma.parentChild.findMany({
        where: { familyId },
        select: { parentId: true, childId: true, relation: true },
      }),
      prisma.marriage.findMany({
        where: { familyId },
        select: { husbandId: true, wifeId: true },
      }),
    ]);

    const result = checkFamilyData(
      { persons, parentChild, marriages },
      { currentYear: new Date().getFullYear() },
    );

    return NextResponse.json({ data: result });
  } catch (e) {
    return handleApiError(e);
  }
}
