/**
 * 族谱圆（同心圆世系图）页面
 *
 * 路由：/f/[familyId]/circle?root=PID
 *
 * 以始祖为圆心、逐代成环辐射展示后代。点击任一人重绘、搜索切换圆心、可打印。
 */
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { layoutRadialChart } from "@/lib/services/radial-chart";
import { RadialChartSvg } from "@/components/charts/RadialChartSvg";
import { WufuRootSearch } from "../wufu/WufuRootSearch";

export const dynamic = "force-dynamic";

export default async function CirclePage({
  params,
  searchParams,
}: {
  params: Promise<{ familyId: string }>;
  searchParams: Promise<{ root?: string }>;
}) {
  const { familyId } = await params;
  const { root: rootParam } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/f/${familyId}/circle`)}`);
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
    select: { id: true, name: true, founderName: true },
  });
  if (!family) notFound();

  const [persons, parentChild] = await Promise.all([
    prisma.person.findMany({
      where: { familyId, deletedAt: null },
      select: { id: true, name: true, gender: true, birthYear: true, birthOrder: true, generation: true },
    }),
    prisma.parentChild.findMany({
      where: { familyId },
      select: { parentId: true, childId: true, isPrimary: true },
    }),
  ]);

  // 选圆心：参数 → 首祖名 → 最低世代男性 → 任意
  let rootId: string | null = rootParam && persons.some((p) => p.id === rootParam) ? rootParam : null;
  if (!rootId && family.founderName) {
    rootId = persons.find((p) => p.name === family.founderName)?.id ?? null;
  }
  if (!rootId && persons.length) {
    const minGen = persons.reduce((m, p) => Math.min(m, p.generation), Number.POSITIVE_INFINITY);
    rootId =
      persons.find((p) => p.generation === minGen && p.gender === "MALE")?.id ??
      persons.find((p) => p.generation === minGen)?.id ??
      persons[0].id;
  }

  const chart = rootId ? layoutRadialChart({ rootPersonId: rootId, persons, parentChild }) : null;

  return (
    <div className="print:bg-white">
      <header className="border-b border-hairline bg-surface print:hidden">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-3 px-3 py-5 sm:px-5 lg:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">族谱圆 · 同心圆世系</p>
            <h1 className="mt-1 font-serif text-xl font-semibold text-foreground">{family.name}</h1>
            <p className="mt-0.5 text-xs text-fg-muted">
              圆心 · {chart?.rootName || "—"}
              {chart ? ` · ${chart.shown} 人 · ${chart.maxDepth + 1} 代` : ""}
              {chart?.truncated ? "（已截断，点击外圈可继续下钻）" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WufuRootSearch familyId={familyId} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] p-3 text-foreground sm:p-5 lg:p-6 print:max-w-none print:p-0">
        {chart && chart.nodes.length > 0 ? (
          <div className="rounded-lg border border-border bg-panel p-4 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
            <RadialChartSvg chart={chart} familyId={familyId} />
            <p className="mt-2 text-center text-xs text-fg-muted print:hidden">
              男 <span className="text-[#2563eb]">●</span> · 女{" "}
              <span className="text-[#db2777]">●</span> · 圆心{" "}
              <span className="text-[#b45309]">●</span>　点击任一人可将其设为新圆心
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-panel p-12 text-center">
            <p className="text-sm text-fg-muted">
              {persons.length ? "请在右上角搜索选择圆心人物" : "该家族尚无人物数据"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
