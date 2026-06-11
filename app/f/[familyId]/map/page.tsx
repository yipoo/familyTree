/**
 * 迁徙图（族人端可视化）
 *
 * 路由：/f/[familyId]/map
 *
 * 三块：
 *   1. 迁徙脉络——地点节点 + 迁徙箭头（拓扑分层 SVG），"因"；
 *   2. 迁徙记事——逐条年份/主体/从→到/事由/原谱注；
 *   3. 聚居分布——各地点现居人数（沿父系继承解析），"果"，
 *      即原谱《住宿地址一览表》的数字化呼应。
 *
 * 数据在后台「迁徙管理」（支系级）与人物页「迁徙」卡片（个人级）维护。
 */
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  layoutMigrationFlow,
  resolveResidenceCounts,
  shortLocationName,
  type FlowEdgeIn,
  type FlowNodeIn,
} from "@/lib/services/migration-map";
import { MigrationFlowSvg } from "@/components/charts/MigrationFlowSvg";

export const dynamic = "force-dynamic";

export default async function MigrationMapPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/f/${familyId}/map`)}`);
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true },
  });
  const member = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId: session.user.id, familyId } },
    select: { role: true },
  });
  if (!member && me?.platformRole !== "SUPERADMIN") {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <h1 className="text-lg font-semibold">无权访问</h1>
        <p className="mt-2 text-sm text-fg-muted">请联系族长邀请你加入此家族。</p>
      </div>
    );
  }

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true, name: true },
  });
  if (!family) notFound();

  const [migrations, persons, parentChild, marriages] = await Promise.all([
    prisma.migration.findMany({
      where: { familyId },
      include: {
        fromLocation: true,
        toLocation: true,
        branch: { select: { name: true } },
        person: { select: { name: true, generation: true } },
      },
      orderBy: [{ year: "asc" }],
    }),
    prisma.person.findMany({
      where: { familyId, deletedAt: null },
      select: { id: true, residenceId: true, gender: true, isMarriedIn: true },
    }),
    prisma.parentChild.findMany({
      where: { familyId },
      select: { parentId: true, childId: true },
    }),
    prisma.marriage.findMany({
      where: { familyId },
      select: { husbandId: true, wifeId: true },
    }),
  ]);

  // 聚居人数（含父系继承）
  const counts = resolveResidenceCounts(persons, parentChild, marriages);

  // 迁徙涉及的地点 → 脉络图节点
  const locById = new Map<
    string,
    { id: string; fullText: string; village: string | null; town: string | null; county: string | null; city: string | null }
  >();
  for (const m of migrations) {
    for (const loc of [m.fromLocation, m.toLocation]) {
      if (loc) locById.set(loc.id, loc);
    }
  }
  const nodesIn: FlowNodeIn[] = Array.from(locById.values()).map((l) => ({
    id: l.id,
    name: shortLocationName(l),
    count: counts.get(l.id) ?? 0,
  }));
  const subjectOf = (m: (typeof migrations)[number]): string =>
    m.scope === "PERSON"
      ? `${m.person?.generation ? `${m.person.generation}世·` : ""}${m.person?.name ?? "某公"}`
      : m.branch?.name ?? "本族";
  const edgesIn: FlowEdgeIn[] = migrations
    .filter((m) => m.fromLocationId && m.toLocationId)
    .map((m) => ({
      fromId: m.fromLocationId!,
      toId: m.toLocationId!,
      subject: subjectOf(m),
      label: `${m.year ? `${m.year} 年 · ` : ""}${m.reason ?? "迁徙"}`,
    }));
  const layout = layoutMigrationFlow(nodesIn, edgesIn);

  // 聚居分布（全部有人居住的地点，按人数降序）
  const allLocs = counts.size
    ? await prisma.location.findMany({ where: { id: { in: Array.from(counts.keys()) } } })
    : [];
  const dist = allLocs
    .map((l) => ({ name: shortLocationName(l), full: l.fullText, count: counts.get(l.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const maxCount = dist[0]?.count ?? 1;
  const totalResolved = dist.reduce((s, d) => s + d.count, 0);

  return (
    <div className="print:bg-white">
      <header className="border-b border-hairline bg-surface print:hidden">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-3 px-3 py-5 sm:px-5 lg:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
              迁徙图 · 脉络与聚居
            </p>
            <h1 className="mt-1 font-serif text-xl font-semibold text-foreground">
              {family.name}
            </h1>
            <p className="mt-0.5 text-xs text-fg-muted">
              迁徙 {migrations.length} 条 · 聚居地 {dist.length} 处 · 已解析居地族人{" "}
              {totalResolved} 人
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-6 p-3 text-foreground sm:p-5 lg:p-6 print:max-w-none print:p-0">
        {/* 1. 迁徙脉络 */}
        <section className="rounded-lg border border-border bg-panel p-4 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <h2 className="mb-3 font-serif text-base font-semibold">迁徙脉络</h2>
          {layout.edges.length > 0 ? (
            <>
              <MigrationFlowSvg layout={layout} />
              <p className="mt-2 text-center text-xs text-fg-muted print:hidden">
                自左而右为迁徙先后 · 节点为地点（注现居人数）· 箭头注迁徙主体与事由
              </p>
            </>
          ) : (
            <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-fg-muted">
              尚无迁徙记录。支系级迁徙在后台「迁徙管理」添加，个人迁徙在人物页「迁徙」卡片添加。
            </p>
          )}
        </section>

        {/* 2. 迁徙记事 */}
        {migrations.length > 0 && (
          <section className="rounded-lg border border-border bg-panel p-4 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
            <h2 className="mb-3 font-serif text-base font-semibold">迁徙记事</h2>
            <ol className="space-y-3">
              {migrations.map((m) => (
                <li key={m.id} className="border-l-2 border-border pl-3">
                  <p className="text-sm">
                    <span className="font-medium text-foreground">{subjectOf(m)}</span>
                    <span className="text-fg-muted">
                      {m.year ? `　${m.year} 年` : ""}
                      {m.fromLocation ? shortLocationName(m.fromLocation) : "—"} →{" "}
                      {m.toLocation ? shortLocationName(m.toLocation) : "—"}
                      {m.reason ? `　（${m.reason}）` : ""}
                    </span>
                  </p>
                  {m.note && <p className="mt-0.5 text-xs leading-5 text-fg-subtle">{m.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 3. 聚居分布 */}
        <section className="rounded-lg border border-border bg-panel p-4 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <h2 className="mb-1 font-serif text-base font-semibold">聚居分布</h2>
          <p className="mb-3 text-xs text-fg-subtle">
            按居住地统计族人（未填居地者沿父系继承、嫁入者随夫）；与三修谱《住宿地址一览表》相呼应（原图见册谱）。
          </p>
          {dist.length > 0 ? (
            <ul className="space-y-1.5">
              {dist.map((d) => (
                <li key={d.full} className="flex items-center gap-2 text-sm">
                  <span className="w-36 shrink-0 truncate sm:w-44" title={d.full}>
                    {d.name}
                  </span>
                  <span className="h-3 rounded-sm bg-brand/70" style={{ width: `${Math.max(2, (d.count / maxCount) * 60)}%` }} />
                  <span className="shrink-0 tabular-nums text-xs text-fg-muted">{d.count} 人</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-fg-muted">
              尚无族人设置居住地。在人物页「基本信息」中设置居住地后，此处自动汇总（后代自动继承）。
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
