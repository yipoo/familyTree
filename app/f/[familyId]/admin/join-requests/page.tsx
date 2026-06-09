/**
 * /f/[familyId]/admin/join-requests —— 入族申请审批
 *
 * 列出 PENDING 在前 + 历史记录。OWNER/ADMIN 可批准 / 拒绝。
 * 批准走 PATCH /api/.../join-requests/[id] {action:"approve"}，会同时建 FamilyMember。
 */

import { prisma } from "@/lib/db";
import { AdminSection, formatDate, maskPhone } from "../_shared";
import { JoinRequestRowActions } from "./RowActions";

export const dynamic = "force-dynamic";

export default async function AdminJoinRequestsPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { isPublic: true },
  });

  const requests = await prisma.joinRequest.findMany({
    where: { familyId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      decidedBy: { select: { id: true, name: true } },
    },
  });

  const pending = requests.filter((r) => r.status === "PENDING");

  return (
    <AdminSection
      title={`入族申请（${pending.length} 待处理 / 共 ${requests.length}）`}
      description="公开家族（/discover 上可被搜到）的访客可发起入族申请。批准会自动把对方加为 MEMBER。"
    >
      {!family?.isPublic && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          当前家族 <b>未公开</b>，外部用户无法在 <code>/discover</code> 上发起申请。
          如需开放，请去家族设置开启"公开"。
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="text-left text-xs text-fg-muted">
            <tr>
              <th className="py-2 pr-4 font-medium">申请人</th>
              <th className="py-2 pr-4 font-medium">联系方式</th>
              <th className="py-2 pr-4 font-medium">留言</th>
              <th className="py-2 pr-4 font-medium">状态</th>
              <th className="py-2 pr-4 font-medium">提交 / 审批</th>
              <th className="py-2 pr-4 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {requests.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center text-xs text-fg-muted"
                >
                  暂无申请。
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="py-2 pr-4">{r.user.name}</td>
                <td className="py-2 pr-4 text-xs text-fg-muted">
                  {r.user.email ?? maskPhone(r.user.phone) ?? "—"}
                </td>
                <td className="max-w-xs py-2 pr-4 text-xs text-fg-muted">
                  {r.message ? (
                    <span className="whitespace-pre-wrap">{r.message}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-4">
                  <StatusBadge status={r.status} />
                </td>
                <td className="py-2 pr-4 text-xs text-fg-muted">
                  <div>{formatDate(r.createdAt)}</div>
                  {r.decidedAt && (
                    <div className="mt-0.5 text-[10px]">
                      {r.decidedBy?.name ?? "—"} · {formatDate(r.decidedAt)}
                    </div>
                  )}
                  {r.decidedNote && (
                    <div className="mt-0.5 text-[10px] italic">
                      备注：{r.decidedNote}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-4">
                  {r.status === "PENDING" ? (
                    <JoinRequestRowActions
                      familyId={familyId}
                      id={r.id}
                      applicantName={r.user.name}
                    />
                  ) : (
                    <span className="text-xs text-fg-subtle">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: {
      label: "待审批",
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    },
    APPROVED: {
      label: "已批准",
      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    },
    REJECTED: {
      label: "已拒绝",
      cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    },
    CANCELLED: {
      label: "已取消",
      cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    },
  };
  const m = map[status] ?? map.PENDING;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
