import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

import { InviteForm } from "./InviteForm";
import {
  ChangeRoleForm,
  RemoveMemberForm,
} from "./RowForms";
import {
  AdminSection,
  RoleBadge,
  formatDate,
  maskPhone,
} from "./_shared";

export const dynamic = "force-dynamic";

/**
 * /f/[familyId]/admin — 默认页 = 成员管理
 */
export default async function AdminMembersPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  const me = await requireUser();

  const members = await prisma.familyMember.findMany({
    where: { familyId },
    include: {
      user: { select: { id: true, name: true, phone: true } },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });

  const meMembership = members.find((m) => m.userId === me.id);
  const isOwner =
    meMembership?.role === "OWNER" || me.platformRole === "SUPERADMIN";

  return (
    <AdminSection
      title={`成员（${members.length}）`}
      description="通过手机号邀请已注册用户。批量分发使用「邀请码」。"
    >
      <InviteForm familyId={familyId} />

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr>
              <th className="py-2 pr-4 font-medium">昵称</th>
              <th className="py-2 pr-4 font-medium">手机</th>
              <th className="py-2 pr-4 font-medium">角色</th>
              <th className="py-2 pr-4 font-medium">加入</th>
              <th className="py-2 pr-4 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {members.map((m) => {
              const self = m.userId === me.id;
              return (
                <tr key={m.id}>
                  <td className="py-2 pr-4">
                    {m.user.name}
                    {self && (
                      <span className="ml-2 text-xs text-zinc-400">（你）</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {maskPhone(m.user.phone)}
                  </td>
                  <td className="py-2 pr-4">
                    <RoleBadge role={m.role} />
                  </td>
                  <td className="py-2 pr-4 text-xs text-zinc-500">
                    {formatDate(m.joinedAt)}
                  </td>
                  <td className="py-2 pr-4">
                    {!self && (
                      <div className="flex items-center gap-2">
                        <ChangeRoleForm
                          familyId={familyId}
                          userId={m.userId}
                          currentRole={m.role}
                          canManageOwner={isOwner}
                        />
                        <RemoveMemberForm
                          familyId={familyId}
                          userId={m.userId}
                          disabled={m.role === "OWNER"}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}
