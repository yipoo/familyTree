/**
 * 册谱入口页：介绍四种体例 + 链接到对应"翻书"页面。
 *
 * /album              ← 入口（本页）
 * /album/diejii       牒记式（行传体，纯文字）
 * /album/ouyang       欧式（横表 5 世为一图）
 * /album/su           苏式（纵排缩进叠层）
 * /album/pagoda       宝塔式（顶端始祖、向下展开）
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STYLES = [
  {
    key: "complete",
    label: "合编本",
    subtitle: "传统印刷家谱完整体例",
    origin: "图谱 + 传记 · 一一对应",
    description:
      "仿传统印刷家谱：封面 / 目录 / 凡例 / 谱序 / 姓氏源流 / 字辈表 / 修谱人员 / 卷一·世系图（吊线图）/ 卷二·世系传（牒记） / 像赞 / 跋。一书在手，与传统纸谱无异。",
    badges: ["图+录", "完整体例", "推荐"],
    accent: "from-violet-50 to-violet-100",
    accentDark: "dark:from-violet-950/40 dark:to-violet-900/30",
    tag: "已实现",
  },
  {
    key: "diejii",
    label: "牒记式",
    subtitle: "传记体 · 纯文字",
    origin: "古老体例 · 文人最爱",
    description:
      "每位族人一段传记：「××公，行第×，字××，号××。生于××，卒于××，享年××。配××氏，子×：……葬于××。」无图，按支系卷、世代章组织。",
    badges: ["传记体", "无图", "可印刷"],
    accent: "from-amber-50 to-amber-100",
    accentDark: "dark:from-amber-950/40 dark:to-amber-900/30",
    tag: "已实现",
  },
  {
    key: "ouyang",
    label: "欧式",
    subtitle: "横排表格 · 5 世为一图",
    origin: "宋·欧阳修创制",
    description:
      "横排表格，左→右一代一列。通常 5 世为一图，第 6 世起另起一图、首列重列第 5 世做接续。每格大字写名、小字注字号生卒。阅读连贯。",
    badges: ["横排", "代数列分", "图表"],
    accent: "from-emerald-50 to-emerald-100",
    accentDark: "dark:from-emerald-950/40 dark:to-emerald-900/30",
    tag: "已实现",
  },
  {
    key: "su",
    label: "苏式",
    subtitle: "纵排叠层 · 缩进显层级",
    origin: "宋·苏洵创制",
    description:
      "纵排叠层：自上而下，子嗣较父辈右缩一格。靠层级缩进表达父子、靠相邻表达兄弟，不画连线。紧凑、便于刻印。",
    badges: ["纵排", "缩进", "刻印友好"],
    accent: "from-rose-50 to-rose-100",
    accentDark: "dark:from-rose-950/40 dark:to-rose-900/30",
    tag: "已实现",
  },
  {
    key: "pagoda",
    label: "宝塔式",
    subtitle: "顶端始祖 · 向下展开",
    origin: "近代图谱常见",
    description:
      "始祖居顶，每代向下分支水平居中，父→子画直角连线。同辈节点等距分布，形似倒置宝塔。视觉对称、一目了然。",
    badges: ["树状", "视觉对称", "代数少"],
    accent: "from-sky-50 to-sky-100",
    accentDark: "dark:from-sky-950/40 dark:to-sky-900/30",
    tag: "已实现",
  },
] as const;

export default async function AlbumOverviewPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/f/${familyId}/album`)}`);
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
      </div>
    );
  }

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      id: true,
      name: true,
      surname: true,
      _count: { select: { persons: true, branches: true } },
    },
  });
  if (!family) notFound();

  return (
    <div>
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-3 px-3 py-6 sm:px-5 lg:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
              册谱
            </p>
            <h1 className="mt-1 font-serif text-2xl font-semibold text-foreground">
              {family.name}
            </h1>
            <p className="mt-1 text-xs text-fg-muted">
              {family._count.persons} 人 · {family._count.branches} 支系
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-3 py-8 sm:px-5 lg:px-6">
        <p className="mb-6 text-sm text-fg-muted">
          传统印刷家谱以"图（世系图）+ 录（世系传）"配对编修。
          推荐"合编本"获得完整阅读体验；亦可单独打开某一体例。
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {STYLES.map((s) => (
            <Link
              key={s.key}
              href={`/f/${familyId}/album/${s.key}`}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-panel transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              {/* 顶部色带模拟"书脊" */}
              <div
                className={`h-24 bg-gradient-to-br ${s.accent} ${s.accentDark} relative flex items-end px-5 py-3`}
              >
                <span
                  className="text-3xl font-semibold tracking-widest text-zinc-900/80 dark:text-zinc-100"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {s.label}
                </span>
                <span
                  className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    s.tag === "已实现"
                      ? "bg-emerald-500 text-white"
                      : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {s.tag}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {s.subtitle}
                  </p>
                  <p className="text-[11px] text-fg-subtle">{s.origin}</p>
                </div>
                <p className="line-clamp-4 text-xs leading-6 text-fg-muted">
                  {s.description}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-1.5">
                  {s.badges.map((b) => (
                    <span
                      key={b}
                      className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] text-fg-muted"
                    >
                      {b}
                    </span>
                  ))}
                  <span className="ml-auto text-xs font-medium text-brand transition group-hover:translate-x-0.5">
                    打开 →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-[11px] text-fg-subtle">
          打开后用 ←/→ 键或点击书页两侧翻页
        </p>
      </main>
    </div>
  );
}
