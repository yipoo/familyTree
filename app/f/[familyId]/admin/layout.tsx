import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { canManageFamily } from "./actions";
import { AdminSidebar } from "./AdminSidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  if (!(await canManageFamily(familyId))) redirect(`/f/${familyId}`);

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true, name: true, surname: true, deletedAt: true },
  });
  if (!family || family.deletedAt) notFound();

  // 待审数量（badge）
  const [pendingCount, joinPendingCount] = await Promise.all([
    prisma.pendingSubmission.count({
      where: { familyId, status: "PENDING" },
    }),
    prisma.joinRequest.count({
      where: { familyId, status: "PENDING" },
    }),
  ]);

  return (
    <div>
      <div className="mx-auto flex max-w-[1440px] gap-6 px-3 py-6 sm:px-5 lg:px-6">
        {/* 左侧菜单 */}
        <aside className="hidden w-56 shrink-0 lg:block print:hidden">
          <div className="sticky top-20">
            <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
              {family.name} · 后台
            </p>
            <AdminSidebar
              familyId={familyId}
              pendingCount={pendingCount}
              joinPendingCount={joinPendingCount}
            />
          </div>
        </aside>

        {/* 右侧内容 */}
        <main className="min-w-0 flex-1">
          {/* 移动端横向菜单 */}
          <div className="mb-4 lg:hidden print:hidden">
            <h1 className="mb-2 font-serif text-lg font-semibold text-foreground">
              {family.name} · 后台
            </h1>
            <AdminSidebar
              familyId={familyId}
              pendingCount={pendingCount}
              joinPendingCount={joinPendingCount}
              horizontal
            />
          </div>

          <div className="space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
