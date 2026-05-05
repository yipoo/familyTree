/**
 * 吊线图（pedigree hanging chart）页面
 *
 * 路由：/f/[familyId]/lineage?root=PID
 *
 * 服务端 SSR：直接调用算法生成布局，再用 LineageChartSvg 渲染。
 * 提供"打印 / 下载 PDF"按钮（浏览器打印），以及"下载 SVG"链接。
 */
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { layoutLineageChart } from "@/lib/services/lineage-chart";
import { LineageChartSvg } from "@/components/charts/LineageChartSvg";
import { LineageChartActions } from "./LineageChartActions";

export const dynamic = "force-dynamic";

export default async function LineageChartPage({
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
    redirect(`/login?next=${encodeURIComponent(`/f/${familyId}/lineage`)}`);
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
        <p className="mt-2 text-sm text-zinc-500">
          请联系族长邀请你加入此家族。
        </p>
      </div>
    );
  }

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: {
      generationNames: { orderBy: { generation: "asc" } },
      branches: {
        orderBy: { name: "asc" },
        include: { rootPerson: true },
      },
    },
  });
  if (!family) notFound();

  const [persons, marriages, parentChild] = await Promise.all([
    prisma.person.findMany({
      where: { familyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        alias: true,
        generation: true,
        generationChar: true,
        gender: true,
        isMarriedIn: true,
        birthOrder: true,
        birthYear: true,
        deathYear: true,
        status: true,
        succession: true,
      },
    }),
    prisma.marriage.findMany({
      where: { familyId },
      select: { husbandId: true, wifeId: true, type: true, order: true },
    }),
    prisma.parentChild.findMany({
      where: { familyId },
      select: { parentId: true, childId: true, birthOrder: true },
    }),
  ]);

  // 选根
  let rootId: string | null = null;
  if (rootParam) {
    rootId = persons.find((p) => p.id === rootParam)?.id ?? null;
  }
  if (!rootId) rootId = family.branches[0]?.rootPersonId ?? null;
  if (!rootId) {
    const minGen = persons.reduce(
      (m, p) => Math.min(m, p.generation),
      Number.POSITIVE_INFINITY,
    );
    rootId = persons.find((p) => p.generation === minGen && p.gender === "MALE")?.id
      ?? persons.find((p) => p.generation === minGen)?.id
      ?? null;
  }

  const layout = rootId
    ? layoutLineageChart({
        rootPersonId: rootId,
        persons,
        parentChild,
        marriages,
      })
    : null;

  const generationChars = Object.fromEntries(
    family.generationNames.map((g) => [g.generation, g.character]),
  );

  const rootName = rootId ? persons.find((p) => p.id === rootId)?.name ?? "" : "";

  return (
    <div className="print:bg-white">
      <header className="border-b border-hairline bg-surface print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
              吊线图
            </p>
            <h1 className="mt-1 font-serif text-xl font-semibold text-foreground">
              {family.name}
            </h1>
            <p className="mt-0.5 text-xs text-fg-muted">
              根 · {rootName || "—"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LineageChartActions
              familyId={familyId}
              rootId={rootId ?? ""}
              branches={family.branches.map((b) => ({
                id: b.id,
                name: b.name,
                rootPersonId: b.rootPersonId,
                rootPersonName: b.rootPerson.name,
              }))}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl overflow-x-auto p-4 sm:p-6 lg:p-8 print:max-w-none print:p-0">
        {layout ? (
          <div className="rounded-lg border border-border bg-panel p-4 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
            <LineageChartSvg
              layout={layout}
              title={family.name}
              subtitle={`首祖 ${rootName} 起 · 共 ${layout.generations.length} 代 · ${layout.nodes.length} 人`}
              generationChars={generationChars}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">该家族尚无人物数据</p>
          </div>
        )}
      </main>
    </div>
  );
}
