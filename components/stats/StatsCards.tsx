/**
 * 服务端组件：把 /api/.../stats 的数据渲染为卡片网格。
 * 直接接受预查好的数据；caller 决定何时刷新。
 */
import Link from "next/link";

export interface StatsData {
  totalPersons: number;
  byGender: Record<string, number>;
  byStatus: Record<string, number>;
  generationCounts: { generation: number; count: number }[];
  generationCoverage: number;
  missingGenerations: number[];
  knownGenerationChars: number;
  branchStats: { branchId: string | null; branchName: string; count: number }[];
  marriagesCount: number;
  avgChildrenPerFather: number;
  totalChildrenRelations: number;
  oldest: { id: string; name: string; birthYear: number | null; generation: number } | null;
  youngest: { id: string; name: string; birthYear: number | null; generation: number } | null;
  topResidences: { id: string; count: number; short: string; fullText: string }[];
  recentWrites30d: number;
}

export function StatsCards({
  familyId,
  stats,
}: {
  familyId: string;
  stats: StatsData;
}) {
  const male = stats.byGender.MALE ?? 0;
  const female = stats.byGender.FEMALE ?? 0;
  const ratio = female > 0 ? (male / female).toFixed(2) : "—";
  const gens = stats.generationCounts.length;

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <Card title="人数" value={stats.totalPersons} hint={`男 ${male} · 女 ${female}（性别比 ${ratio}）`} />
      <Card title="代数" value={gens} hint={`字辈覆盖 ${(stats.generationCoverage * 100).toFixed(0)}%`} />
      <Card title="婚配" value={stats.marriagesCount} hint={`平均子女 ${stats.avgChildrenPerFather}`} />
      <Card title="近 30 天写操作" value={stats.recentWrites30d} hint="审计日志活跃度" />

      <CardWide title="各代分布">
        <ul className="flex flex-wrap gap-1.5 text-xs">
          {stats.generationCounts.map((g) => (
            <li
              key={g.generation}
              className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <span className="text-zinc-500">{g.generation}世</span>
              <span className="ml-1 font-mono">{g.count}</span>
            </li>
          ))}
        </ul>
        {stats.missingGenerations.length > 0 && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            缺字辈：{stats.missingGenerations.join("、")} 世
          </p>
        )}
      </CardWide>

      <CardWide title="各支系人数">
        <ul className="flex flex-wrap gap-1.5 text-xs">
          {stats.branchStats.map((b) => (
            <li
              key={b.branchId ?? "_"}
              className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {b.branchName} · <span className="font-mono">{b.count}</span>
            </li>
          ))}
        </ul>
      </CardWide>

      <CardWide title="居住地分布 Top 10">
        {stats.topResidences.length === 0 ? (
          <p className="text-xs text-zinc-500">暂无居住地数据</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {stats.topResidences.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between">
                <span className="truncate" title={r.fullText}>
                  {r.short || r.fullText}
                </span>
                <span className="font-mono text-zinc-500">{r.count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardWide>

      <CardWide title="最年长 / 最年轻">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {stats.oldest ? (
            <Link
              href={`/f/${familyId}/p/${stats.oldest.id}`}
              className="block rounded border border-zinc-200 p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <span className="text-zinc-500">最早</span>
              <div className="font-medium">
                {stats.oldest.name}（{stats.oldest.birthYear}）
              </div>
              <div className="text-zinc-500">第 {stats.oldest.generation} 世</div>
            </Link>
          ) : (
            <div className="text-zinc-500">暂无生年数据</div>
          )}
          {stats.youngest ? (
            <Link
              href={`/f/${familyId}/p/${stats.youngest.id}`}
              className="block rounded border border-zinc-200 p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <span className="text-zinc-500">最近</span>
              <div className="font-medium">
                {stats.youngest.name}（{stats.youngest.birthYear}）
              </div>
              <div className="text-zinc-500">第 {stats.youngest.generation} 世</div>
            </Link>
          ) : (
            <div className="text-zinc-500">—</div>
          )}
        </div>
      </CardWide>
    </section>
  );
}

function Card({
  title,
  value,
  hint,
}: {
  title: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{title}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function CardWide({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="col-span-2 sm:col-span-3 lg:col-span-4 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 text-xs font-medium text-zinc-500">{title}</div>
      {children}
    </div>
  );
}
