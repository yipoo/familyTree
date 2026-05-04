/**
 * 支系级迁徙管理（后台）。
 * 路由：/f/[familyId]/admin/migrations
 *
 * 仅 ADMIN+。每个支系一张折叠面板，可增删改其支系级迁徙。
 */
import { prisma } from "@/lib/db";

import { AdminSection } from "../_shared";
import { BranchMigrationsCard } from "./BranchMigrationsCard";

export const dynamic = "force-dynamic";

export default async function AdminMigrationsPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  const branches = await prisma.branch.findMany({
    where: { familyId },
    orderBy: { name: "asc" },
    include: { rootPerson: { select: { name: true } } },
  });

  return (
    <AdminSection
      title="支系迁徙"
      description="维护每个支系的整体迁徙轨迹（如某支整体由 A 迁至 B）。"
    >
      {branches.length === 0 ? (
        <p className="text-sm text-zinc-500">暂无支系。先在数据中建立支系再来此添加迁徙。</p>
      ) : (
        <div className="space-y-3">
          {branches.map((b) => (
            <BranchMigrationsCard
              key={b.id}
              familyId={familyId}
              branchId={b.id}
              branchName={`${b.name}（根 ${b.rootPerson.name}）`}
            />
          ))}
        </div>
      )}
    </AdminSection>
  );
}
