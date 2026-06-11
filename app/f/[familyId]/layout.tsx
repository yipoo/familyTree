/**
 * /f/[familyId] 共用 layout。
 *
 * 因为全局 TopNav 已经从 RootLayout 渲染（含家族切换 / 视图 Tab），
 * 这里 layout 主要做两件事：
 *
 *   1. 确认 family 存在 + 当前用户有访问权限（成员 或 SUPERADMIN）
 *   2. 套一个统一的 page 容器（背景、最大宽度由各页自定）
 *
 * 子页面（tree / table / lineage / album / search / admin / p）的页头
 * 已经被 TopNav 覆盖，子页内不要再渲染重复的页头。
 */
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FamilyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/f/${familyId}`)}`);
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true },
  });

  // SUPERADMIN 跳过 membership 检查
  if (me?.platformRole !== "SUPERADMIN") {
    const member = await prisma.familyMember.findUnique({
      where: {
        userId_familyId: { userId: session.user.id, familyId },
      },
      select: { role: true },
    });
    if (!member) {
      // 该家族不在 membership 里 —— 检查家族存不存在以决定 404 / 无权
      const exists = await prisma.family.findUnique({
        where: { id: familyId },
        select: { id: true, deletedAt: true },
      });
      if (!exists || exists.deletedAt) notFound();
      // 存在但无权 —— 跳回 dashboard
      redirect(`/dashboard?denied=${familyId}`);
    }
  } else {
    // 超管也要看家族存在
    const exists = await prisma.family.findUnique({
      where: { id: familyId },
      select: { id: true, deletedAt: true },
    });
    if (!exists || exists.deletedAt) notFound();
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background text-foreground">
      {children}
    </div>
  );
}
