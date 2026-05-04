import { prisma } from "@/lib/db";
import { CreateShareForm } from "../ShareForm";
import { RevokeShareForm, ShareTokenCopy } from "../RowForms";
import { AdminSection, ExpiryLabel, formatDate } from "../_shared";

export const dynamic = "force-dynamic";

export default async function AdminSharesPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  const shareLinks = await prisma.shareLink.findMany({
    where: { familyId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminSection
      title={`分享链接（${shareLinks.length}）`}
      description="生成只读链接，未登录的访客也可查看。撤销后该 URL 立即失效。"
    >
      <CreateShareForm familyId={familyId} />

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr>
              <th className="py-2 pr-4 font-medium">链接</th>
              <th className="py-2 pr-4 font-medium">过期</th>
              <th className="py-2 pr-4 font-medium">创建时间</th>
              <th className="py-2 pr-4 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {shareLinks.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-xs text-zinc-400">
                  暂无分享链接
                </td>
              </tr>
            )}
            {shareLinks.map((s) => (
              <tr key={s.id}>
                <td className="py-2 pr-4">
                  <ShareTokenCopy token={s.token} />
                </td>
                <td className="py-2 pr-4 text-xs">
                  <ExpiryLabel d={s.expiresAt} />
                </td>
                <td className="py-2 pr-4 text-xs text-zinc-500">
                  {formatDate(s.createdAt)}
                </td>
                <td className="py-2 pr-4">
                  <RevokeShareForm familyId={familyId} id={s.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}
