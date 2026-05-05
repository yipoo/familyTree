import Link from "next/link";

import { prisma } from "@/lib/db";
import { requireFamilyRole } from "@/lib/auth/guard";
import { AdminSection } from "../_shared";
import { BranchManagerClient } from "./BranchManagerClient";

export const dynamic = "force-dynamic";

export default async function AdminBranchesPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  await requireFamilyRole(familyId, "MEMBER");

  const [branches, persons] = await Promise.all([
    prisma.branch.findMany({
      where: { familyId },
      orderBy: { name: "asc" },
      include: {
        rootPerson: { select: { id: true, name: true, generation: true } },
        location: { select: { id: true, fullText: true } },
        _count: { select: { persons: true, migrations: true } },
      },
    }),
    // 候选根人物：仅前 200 位 OWNER 系男性，足够新建/调整时挑选；超过的可在前端搜索
    prisma.person.findMany({
      where: { familyId, deletedAt: null, gender: "MALE" },
      select: { id: true, name: true, generation: true },
      orderBy: [{ generation: "asc" }, { birthOrder: "asc" }],
      take: 200,
    }),
  ]);

  return (
    <AdminSection
      title={`支系管理（${branches.length}）`}
      description="新建 / 修改 / 删除支系。挂载有人物或迁徙记录的支系不能直接删除。"
      actions={
        <Link
          href={`/f/${familyId}`}
          className="text-xs text-fg-muted hover:underline"
        >
          ← 返回家族
        </Link>
      }
    >
      <BranchManagerClient
        familyId={familyId}
        branches={branches.map((b) => ({
          id: b.id,
          name: b.name,
          rootPersonId: b.rootPersonId,
          rootPersonName: b.rootPerson?.name ?? "—",
          locationFullText: b.location?.fullText ?? null,
          description: b.description ?? null,
          personCount: b._count.persons,
          migrationCount: b._count.migrations,
        }))}
        persons={persons.map((p) => ({
          id: p.id,
          name: p.name,
          generation: p.generation,
        }))}
      />
    </AdminSection>
  );
}
