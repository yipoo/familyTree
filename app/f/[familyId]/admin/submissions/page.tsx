import Link from "next/link";

import { prisma } from "@/lib/db";
import { parsePayload } from "@/lib/services/submissions";
import { AdminSection } from "../_shared";
import { ReviewActions } from "./ReviewActions";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ familyId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { familyId } = await params;
  const { status: statusRaw } = await searchParams;
  const status: "PENDING" | "APPROVED" | "REJECTED" =
    statusRaw === "APPROVED"
      ? "APPROVED"
      : statusRaw === "REJECTED"
        ? "REJECTED"
        : "PENDING";

  // 权限 / 家族存在性已在 admin/layout.tsx 里校验过

  const list = await prisma.pendingSubmission.findMany({
    where: { familyId, status },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const userIds = [
    ...new Set(
      list.flatMap((s) => [s.submitterId, s.reviewerId].filter(Boolean) as string[]),
    ),
  ];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const counts = await prisma.pendingSubmission.groupBy({
    by: ["status"],
    where: { familyId },
    _count: { _all: true },
  });
  const countOf = (s: string) =>
    counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <AdminSection
      title="待审提交"
      description="成员提交的修改建议，审核通过后即应用到正式数据"
    >
      <nav className="mb-4 flex gap-2 text-sm">
          {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
            <Link
              key={s}
              href={`/f/${familyId}/admin/submissions?status=${s}`}
              className={`rounded-full px-3 py-1 transition ${
                status === s
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              {labelOf(s)}（{countOf(s)}）
            </Link>
          ))}
        </nav>

        {list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            暂无{labelOf(status)}的提交
          </p>
        ) : (
          <ul className="space-y-3">
            {list.map((s) => {
              const payload = parsePayload(s.payload);
              return (
                <li
                  key={s.id}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-sm">
                      <strong>{nameById.get(s.submitterId) ?? "—"}</strong>
                      <span className="ml-2 text-xs text-zinc-500">
                        提交于 {formatDateTime(s.createdAt)}
                      </span>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>

                  {payload?.source === "collect" && payload.contributor?.name ? (
                    <p className="mt-2 inline-block rounded bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      二维码采集 · 填写人 {payload.contributor.name}
                      {payload.contributor.relation ? `（${payload.contributor.relation}）` : ""}
                      {payload.contributor.phone ? ` · ${payload.contributor.phone}` : ""}
                    </p>
                  ) : null}

                  {payload?.kind === "person-update" ? (
                    <PersonUpdateView payload={payload} />
                  ) : payload?.kind === "person-add-child" ? (
                    <AddChildView payload={payload} />
                  ) : (
                    <p className="mt-2 text-xs text-red-600">提交内容无法解析</p>
                  )}

                  {s.status === "PENDING" && (
                    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <ReviewActions familyId={familyId} id={s.id} />
                    </div>
                  )}

                  {s.status !== "PENDING" && s.reviewerId && (
                    <div className="mt-2 text-xs text-zinc-500">
                      由 {nameById.get(s.reviewerId) ?? "—"} 于{" "}
                      {s.reviewedAt ? formatDateTime(s.reviewedAt) : "—"}{" "}
                      {s.status === "APPROVED" ? "通过" : "拒绝"}
                      {s.reviewNote && (
                        <span className="ml-1">· {s.reviewNote}</span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
    </AdminSection>
  );
}

function PersonUpdateView({
  payload,
}: {
  payload: Extract<
    NonNullable<ReturnType<typeof parsePayload>>,
    { kind: "person-update" }
  >;
}) {
  const entries = Object.entries(payload.changes);
  return (
    <div className="mt-2 text-sm">
      <div className="text-xs text-zinc-500">
        修改人物 <strong className="text-zinc-700 dark:text-zinc-200">{payload.personName}</strong>
      </div>
      <table className="mt-2 w-full text-xs">
        <thead className="text-left text-[11px] text-zinc-400">
          <tr>
            <th className="py-1 pr-4 font-medium">字段</th>
            <th className="py-1 font-medium">建议值</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-1 pr-4 text-zinc-600 dark:text-zinc-400">
                {fieldLabel(k)}
              </td>
              <td className="py-1 text-zinc-900 dark:text-zinc-100">
                {v === null || v === "" ? (
                  <span className="text-zinc-400">（清空）</span>
                ) : (
                  String(v)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddChildView({
  payload,
}: {
  payload: Extract<
    NonNullable<ReturnType<typeof parsePayload>>,
    { kind: "person-add-child" }
  >;
}) {
  const c = payload.child;
  const g = c.gender === "MALE" ? "男" : c.gender === "FEMALE" ? "女" : "不详";
  return (
    <div className="mt-2 text-sm">
      <div className="text-xs text-zinc-500">
        为 <strong className="text-zinc-700 dark:text-zinc-200">{payload.parentName}</strong> 新增子女
      </div>
      <table className="mt-2 w-full text-xs">
        <tbody>
          <tr className="border-t border-zinc-100 dark:border-zinc-800">
            <td className="py-1 pr-4 text-zinc-600 dark:text-zinc-400">姓名</td>
            <td className="py-1 text-zinc-900 dark:text-zinc-100">{c.name}</td>
          </tr>
          <tr className="border-t border-zinc-100 dark:border-zinc-800">
            <td className="py-1 pr-4 text-zinc-600 dark:text-zinc-400">性别</td>
            <td className="py-1 text-zinc-900 dark:text-zinc-100">{g}</td>
          </tr>
          {c.birthYear ? (
            <tr className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-1 pr-4 text-zinc-600 dark:text-zinc-400">出生年</td>
              <td className="py-1 text-zinc-900 dark:text-zinc-100">{c.birthYear}</td>
            </tr>
          ) : null}
          {c.birthPlace ? (
            <tr className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-1 pr-4 text-zinc-600 dark:text-zinc-400">出生地</td>
              <td className="py-1 text-zinc-900 dark:text-zinc-100">{c.birthPlace}</td>
            </tr>
          ) : null}
          {c.note ? (
            <tr className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-1 pr-4 text-zinc-600 dark:text-zinc-400">备注</td>
              <td className="py-1 text-zinc-900 dark:text-zinc-100">{c.note}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    PENDING:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    APPROVED:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    REJECTED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${m[status] ?? ""}`}>
      {labelOf(status)}
    </span>
  );
}

function labelOf(s: string) {
  return s === "PENDING"
    ? "待审"
    : s === "APPROVED"
      ? "已通过"
      : s === "REJECTED"
        ? "已拒绝"
        : s;
}

function fieldLabel(k: string) {
  return (
    {
      name: "姓名",
      alias: "别名",
      birthOrder: "排行",
      status: "状态",
      birthYear: "出生年",
      deathYear: "去世年",
      birthPlace: "出生地",
      biography: "传记",
      note: "备注",
    } as Record<string, string>
  )[k] ?? k;
}

function formatDateTime(d: Date) {
  return new Date(d).toLocaleString("zh-CN");
}
