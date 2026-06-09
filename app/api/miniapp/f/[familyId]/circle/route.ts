/**
 * 小程序：族谱圆数据（只读，复用 radial-chart.ts）
 *   GET ?root=<personId>   缺省以家族首祖 / 最低世代
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireSession, canAccessFamily } from "@/lib/auth/miniapp";
import { layoutRadialChart } from "@/lib/services/radial-chart";

export async function GET(req: Request, ctx: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await ctx.params;
  const claims = requireSession(req);
  if (!claims) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "请先登录" } }, { status: 401 });
  }
  if (!(await canAccessFamily(claims.userId!, familyId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问该家族" } }, { status: 403 });
  }

  const [persons, parentChild, family] = await Promise.all([
    prisma.person.findMany({
      where: { familyId, deletedAt: null },
      select: { id: true, name: true, gender: true, birthYear: true, birthOrder: true, generation: true },
    }),
    prisma.parentChild.findMany({ where: { familyId }, select: { parentId: true, childId: true, isPrimary: true } }),
    prisma.family.findUnique({ where: { id: familyId }, select: { founderName: true } }),
  ]);

  const url = new URL(req.url);
  let rootId = url.searchParams.get("root");
  if (!rootId || !persons.some((p) => p.id === rootId)) {
    rootId = (family?.founderName && persons.find((p) => p.name === family.founderName)?.id) || null;
    if (!rootId && persons.length) {
      const minGen = persons.reduce((m, p) => Math.min(m, p.generation), Number.POSITIVE_INFINITY);
      rootId = persons.find((p) => p.generation === minGen)?.id ?? persons[0].id;
    }
  }

  const chart = rootId ? layoutRadialChart({ rootPersonId: rootId, persons, parentChild }) : null;
  return NextResponse.json({ data: chart });
}
