import { prisma } from "@/lib/db";
import { CreateInviteForm } from "../InviteFormCreate";
import { InviteCodeCopy, RevokeInviteForm } from "../RowForms";
import { AdminSection, ExpiryLabel, formatDate, roleZh } from "../_shared";

export const dynamic = "force-dynamic";

export default async function AdminInvitesPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;

  const invites = await prisma.familyInvite.findMany({
    where: { familyId },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const active = invites.filter(
    (i) =>
      !i.revokedAt &&
      (!i.expiresAt || i.expiresAt.getTime() > Date.now()) &&
      (i.maxUses === null || i.uses < i.maxUses),
  ).length;

  return (
    <AdminSection
      title={`邀请码（${active} 个有效 / 共 ${invites.length}）`}
      description="生成后分享给亲友（链接或 8 位码），对方登录后凭码即可加入家族，无需逐一审批。可设单次/多次/期限。"
    >
      <CreateInviteForm familyId={familyId} />

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr>
              <th className="py-2 pr-4 font-medium">码</th>
              <th className="py-2 pr-4 font-medium">角色</th>
              <th className="py-2 pr-4 font-medium">用量</th>
              <th className="py-2 pr-4 font-medium">过期</th>
              <th className="py-2 pr-4 font-medium">备注</th>
              <th className="py-2 pr-4 font-medium">创建</th>
              <th className="py-2 pr-4 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {invites.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-xs text-zinc-400">
                  暂无邀请码
                </td>
              </tr>
            )}
            {invites.map((i) => {
              const dead =
                !!i.revokedAt ||
                (i.expiresAt && i.expiresAt.getTime() < Date.now()) ||
                (i.maxUses !== null && i.uses >= i.maxUses);
              return (
                <tr key={i.id} className={dead ? "opacity-50" : ""}>
                  <td className="py-2 pr-4">
                    <InviteCodeCopy code={i.code} />
                  </td>
                  <td className="py-2 pr-4 text-xs">{roleZh(i.role)}</td>
                  <td className="py-2 pr-4 text-xs text-zinc-500">
                    {i.uses}
                    {i.maxUses !== null && ` / ${i.maxUses}`}
                  </td>
                  <td className="py-2 pr-4 text-xs">
                    <ExpiryLabel d={i.expiresAt} />
                  </td>
                  <td className="py-2 pr-4 text-xs text-zinc-500">
                    {i.note ?? "—"}
                  </td>
                  <td className="py-2 pr-4 text-xs text-zinc-500">
                    {i.createdBy.name} · {formatDate(i.createdAt)}
                    {i.revokedAt && (
                      <span className="ml-1 text-red-500">已撤销</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {!i.revokedAt && (
                      <RevokeInviteForm familyId={familyId} id={i.id} />
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
