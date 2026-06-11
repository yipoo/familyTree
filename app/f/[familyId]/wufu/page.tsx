/**
 * 五服图（本宗九族五服之图）页面
 *
 * 路由：/f/[familyId]/wufu?root=PID
 *
 * 以某人为「己」，SSR 计算其本宗五服亲属并按辈分排布、按服制配色。
 * 支持搜索切换中心人物、点击亲属重绘、浏览器打印。
 */
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { computeWufu } from "@/lib/services/wufu";
import { layoutWufuTree } from "@/lib/services/wufu-tree";
import { hashPhone } from "@/lib/services/phone";
import { WufuTreeSvg } from "@/components/charts/WufuTreeSvg";
import { WufuRootSearch } from "./WufuRootSearch";

export const dynamic = "force-dynamic";

export default async function WufuPage({
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
    redirect(`/login?next=${encodeURIComponent(`/f/${familyId}/wufu`)}`);
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true, phone: true },
  });
  const member = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId: session.user.id, familyId } },
    select: { role: true, personId: true },
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

  const [persons, parentChild, marriages] = await Promise.all([
    prisma.person.findMany({
      where: { familyId, deletedAt: null },
      select: { id: true, name: true, gender: true, birthYear: true, birthOrder: true, generation: true },
    }),
    prisma.parentChild.findMany({
      where: { familyId },
      select: { parentId: true, childId: true, isPrimary: true },
    }),
    prisma.marriage.findMany({
      where: { familyId },
      select: { husbandId: true, wifeId: true },
    }),
  ]);

  // 五服图以「登录者本人」为中心。先找"我"在本族的人物节点：
  //   1) FamilyMember.personId（族长在后台关联）
  //   2) 手机号哈希匹配 Person.contactPhoneHash（二维码采集 / 小程序绑定）
  let myPersonId: string | null =
    member?.personId && persons.some((p) => p.id === member.personId)
      ? member.personId
      : null;
  if (!myPersonId && me?.phone) {
    const h = hashPhone(me.phone);
    if (h) {
      const mine = await prisma.person.findFirst({
        where: { familyId, deletedAt: null, contactPhoneHash: h },
        select: { id: true },
      });
      if (mine) myPersonId = mine.id;
    }
  }

  // 中心：URL 参数（搜索 / 点击切换）优先，否则默认"我"
  const paramRoot =
    rootParam && persons.some((p) => p.id === rootParam) ? rootParam : null;
  const rootId = paramRoot ?? myPersonId;
  // 无参数且未关联到本族人物 → 提醒（登录者不在族谱内）
  const notLinked = !paramRoot && !myPersonId;

  const chart = rootId
    ? computeWufu({ rootPersonId: rootId, persons, parentChild, marriages })
    : null;

  const tree =
    chart && chart.total > 0
      ? layoutWufuTree({
          chart,
          parentChild,
          birthOrderById: new Map(persons.map((p) => [p.id, p.birthOrder])),
        })
      : null;

  return (
    <div className="print:bg-white">
      <header className="border-b border-hairline bg-surface print:hidden">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-3 px-3 py-5 sm:px-5 lg:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
              五服图 · 本宗九族
            </p>
            <h1 className="mt-1 font-serif text-xl font-semibold text-foreground">
              {family.name}
            </h1>
            <p className="mt-0.5 text-xs text-fg-muted">
              己 · {chart?.rootName || "—"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WufuRootSearch familyId={familyId} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] p-3 sm:p-5 lg:p-6 print:max-w-none print:p-0">
        <div className="mb-3 hidden print:block">
          <h1 className="text-center font-serif text-2xl font-semibold">
            {family.name} · 五服图
          </h1>
          <p className="text-center text-sm">己 · {chart?.rootName}</p>
        </div>
        {chart && tree ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs print:hidden">
              <span className="font-medium text-fg-muted">关系：</span>
              <span className="inline-flex items-center gap-1.5">
                <i
                  className="inline-block h-3 w-3 rounded-sm border-2"
                  style={{ borderColor: "#4f46e5", background: "#eef2ff" }}
                />
                己（本人）
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i
                  className="inline-block h-3 w-3 rounded-sm border"
                  style={{ borderColor: "#10b981", background: "#ecfdf5" }}
                />
                直系血亲
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i
                  className="inline-block h-3 w-3 rounded-sm border"
                  style={{ borderColor: "#64748b", background: "#fff" }}
                />
                旁系男
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i
                  className="inline-block h-3 w-3 rounded-sm border"
                  style={{ borderColor: "#ec4899", background: "#fff" }}
                />
                本族女
              </span>
              <span className="text-fg-muted">（配偶挂其名下做小字）</span>
              <span className="ml-auto text-fg-muted">
                五服之内共 {chart.total} 人（含己）· 点击血亲改为中心
              </span>
            </div>
            <WufuTreeSvg layout={tree} familyId={familyId} />
          </div>
        ) : notLinked ? (
          <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-10 text-center dark:border-amber-800/60 dark:bg-amber-950/20 print:hidden">
            <p className="text-2xl">🧭</p>
            <p className="mt-3 text-sm font-medium text-amber-800 dark:text-amber-300">
              你还未关联到本族族谱中的人物
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-amber-700/90 dark:text-amber-400/90">
              五服图默认以「你本人」为中心，但系统未找到你在本族对应的人物节点。
              你可以在右上角搜索选择一位族人查看其五服，或联系族长在「后台 → 成员」里
              把你的账号关联到族谱中的本人（也可通过二维码采集登记手机号自动匹配）。
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-panel p-12 text-center">
            <p className="text-sm text-fg-muted">
              {persons.length ? "请在右上角搜索选择中心人物" : "该家族尚无人物数据"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
