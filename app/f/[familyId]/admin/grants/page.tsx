import { prisma } from "@/lib/db";
import { GrantForm } from "../GrantForm";
import { RevokeGrantForm } from "../RowForms";
import { AdminSection, formatDate } from "../_shared";

export const dynamic = "force-dynamic";

export default async function AdminGrantsPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;

  const [members, grants] = await Promise.all([
    prisma.familyMember.findMany({
      where: { familyId },
      include: { user: { select: { id: true, name: true, phone: true } } },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    }),
    prisma.subtreeAdmin.findMany({
      where: { familyId },
      include: {
        user: { select: { id: true, name: true } },
        root: { select: { id: true, name: true, generation: true } },
        grantedBy: { select: { name: true } },
      },
      orderBy: { grantedAt: "desc" },
    }),
  ]);

  return (
    <AdminSection
      title={`子树管理员（${grants.length}）`}
      description="授予某用户对「指定人物及其父系后代」的写权限。沿 isPrimary 父子关系上溯，过继与生父分流。"
    >
      <GrantForm
        familyId={familyId}
        members={members.map((m) => ({
          userId: m.userId,
          name: m.user.name,
          role: m.role,
        }))}
      />

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr>
              <th className="py-2 pr-4 font-medium">用户</th>
              <th className="py-2 pr-4 font-medium">子树根人物</th>
              <th className="py-2 pr-4 font-medium">备注</th>
              <th className="py-2 pr-4 font-medium">授权人</th>
              <th className="py-2 pr-4 font-medium">时间</th>
              <th className="py-2 pr-4 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {grants.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-xs text-zinc-400">
                  暂无授权
                </td>
              </tr>
            )}
            {grants.map((g) => (
              <tr key={g.id}>
                <td className="py-2 pr-4">{g.user.name}</td>
                <td className="py-2 pr-4">
                  {g.root.name}
                  <span className="ml-1.5 text-xs text-zinc-400">
                    第 {g.root.generation} 世
                  </span>
                </td>
                <td className="py-2 pr-4 text-xs text-zinc-500">
                  {g.note ?? "—"}
                </td>
                <td className="py-2 pr-4 text-xs text-zinc-500">
                  {g.grantedBy.name}
                </td>
                <td className="py-2 pr-4 text-xs text-zinc-500">
                  {formatDate(g.grantedAt)}
                </td>
                <td className="py-2 pr-4">
                  <RevokeGrantForm familyId={familyId} grantId={g.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}
