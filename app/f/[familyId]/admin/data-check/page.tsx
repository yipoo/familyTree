import Link from "next/link";

import { prisma } from "@/lib/db";
import { checkFamilyData, type CheckLevel } from "@/lib/services/data-check";
import { AdminSection } from "../_shared";

export const dynamic = "force-dynamic";

const LEVEL_META: Record<CheckLevel, { label: string; cls: string }> = {
  error: { label: "错误", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  warning: { label: "警告", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  info: { label: "提示", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400" },
};

export default async function AdminDataCheckPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;

  const [persons, parentChild, marriages] = await Promise.all([
    prisma.person.findMany({
      where: { familyId, deletedAt: null },
      select: { id: true, name: true, gender: true, generation: true, birthYear: true, deathYear: true },
    }),
    prisma.parentChild.findMany({
      where: { familyId },
      select: { parentId: true, childId: true, relation: true },
    }),
    prisma.marriage.findMany({
      where: { familyId },
      select: { husbandId: true, wifeId: true },
    }),
  ]);

  const nameById = new Map(persons.map((p) => [p.id, p.name]));
  const result = checkFamilyData(
    { persons, parentChild, marriages },
    { currentYear: new Date().getFullYear() },
  );

  return (
    <AdminSection
      title="数据体检"
      description="自动检查全族数据的一致性，列出生卒矛盾、年龄倒挂、世代不连续、疑似重复等问题，便于修订。刷新页面即重新检查。"
    >
      {/* 汇总 */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Pill level="error" n={result.counts.error} />
        <Pill level="warning" n={result.counts.warning} />
        <Pill level="info" n={result.counts.info} />
        <span className="ml-auto text-xs text-zinc-500">共检查 {result.checked} 人</span>
      </div>

      {result.issues.length === 0 ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          ✅ 未发现明显问题，数据质量良好。
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {result.issues.map((issue, i) => (
            <li
              key={i}
              className="flex flex-wrap items-start gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${LEVEL_META[issue.level].cls}`}>
                {LEVEL_META[issue.level].label}
              </span>
              <span className="min-w-0 flex-1">
                {issue.message}
                {issue.personIds.length > 0 ? (
                  <span className="ml-2 inline-flex flex-wrap gap-1.5">
                    {[...new Set(issue.personIds)].slice(0, 8).map((pid) => (
                      <Link
                        key={pid}
                        href={`/f/${familyId}/p/${pid}`}
                        className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-blue-600 hover:underline dark:bg-zinc-800 dark:text-blue-400"
                      >
                        {nameById.get(pid) ?? "查看"} →
                      </Link>
                    ))}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AdminSection>
  );
}

function Pill({ level, n }: { level: CheckLevel; n: number }) {
  const m = LEVEL_META[level];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${m.cls}`}>
      {m.label} {n}
    </span>
  );
}
