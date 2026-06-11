/**
 * 小程序：当前用户 + 我的位置（各家族中我的节点）
 *   GET  (Bearer session)
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireSession, resolveMyPositions } from "@/lib/auth/miniapp";

export async function GET(req: Request) {
  const claims = requireSession(req);
  if (!claims) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "请先登录" } },
      { status: 401 },
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, name: true, avatarUrl: true },
  });
  if (!user) {
    return NextResponse.json({ error: { code: "NO_USER", message: "用户不存在" } }, { status: 401 });
  }
  const positions = await resolveMyPositions(user.id);
  return NextResponse.json({ data: { user, positions } });
}
