/**
 * 小程序：人物搜索（只读）
 *   GET ?q=张&limit=20
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireSession, canAccessFamily } from "@/lib/auth/miniapp";

export async function GET(req: Request, ctx: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await ctx.params;
  const claims = requireSession(req);
  if (!claims) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "请先登录" } }, { status: 401 });
  }
  if (!(await canAccessFamily(claims.userId!, familyId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "无权访问该家族" } }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "20"), 1), 50);
  if (!q) return NextResponse.json({ data: [] });

  const persons = await prisma.person.findMany({
    where: {
      familyId,
      deletedAt: null,
      OR: [{ name: { contains: q, mode: "insensitive" } }, { alias: { contains: q, mode: "insensitive" } }],
    },
    select: { id: true, name: true, alias: true, gender: true, generation: true, generationChar: true },
    orderBy: [{ generation: "asc" }, { name: "asc" }],
    take: limit,
  });
  return NextResponse.json({ data: persons });
}
