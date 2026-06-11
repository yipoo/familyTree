/**
 * /dashboard —— 已登录用户落地页（"我的家族"仪表盘）。
 *
 * 结构：
 *   - 欢迎 banner + 三张概览数据卡（家族数 / 人数 / 本月新增）
 *   - 家族卡片网格：每张卡含姓氏徽标、人数 / 字辈 / 支系、最近访问时间、进入按钮
 *   - 快捷动作：加入家族 / 导入 / 设置
 *   - 最近活动：从最近一个家族的审计日志取
 *   - 空态：插画 + 加入家族 CTA
 *
 * 注意：本组件被 /dashboard/page.tsx 调用；同时供未来用作 /__preview__/dashboard
 * 时通过 props 注入 mock 数据。如未提供 props，则从 prisma 读取。
 */
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

import { CreateFamilyButton } from "@/components/family/CreateFamilyButton";
import {
  IconBook,
  IconChevronRight,
  IconClock,
  IconExternalLink,
  IconFileText,
  IconLineage,
  IconPlus,
  IconRoute,
  IconTree,
  IconUser,
  IconUsers,
} from "@/components/layout/icons";

// ---------- 类型 ----------

export interface DashboardFamily {
  id: string;
  name: string;
  surname: string;
  description?: string | null;
  myRole?: string | null;
  branches: number;
  persons: number;
  generations: number;
  lastVisited?: string | null; // ISO
}

export interface DashboardSubtreeGrant {
  familyId: string;
  rootPersonId: string;
  rootName: string;
  rootGeneration: number;
}

export interface DashboardActivity {
  id: string;
  familyId: string;
  familyName: string;
  kind: string;
  entity: string;
  actorName: string;
  createdAt: string; // ISO
  hint?: string;
}

export interface DashboardData {
  userName: string;
  isSuper: boolean;
  families: DashboardFamily[];
  grants: DashboardSubtreeGrant[];
  activity: DashboardActivity[];
  totals: {
    families: number;
    persons: number;
    newThisMonth: number;
  };
}

// ---------- 数据获取（默认从 prisma） ----------

async function loadDashboardData(): Promise<DashboardData> {
  const session = await auth();
  const userId = session!.user.id;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, phone: true, platformRole: true },
  });
  const isSuper = me?.platformRole === "SUPERADMIN";

  type FamilyRow = Awaited<
    ReturnType<typeof prisma.family.findMany>
  >[number] & {
    myRole?: string;
    _count: { persons: number; branches: number; generationNames: number };
  };

  const familiesRaw: FamilyRow[] = isSuper
    ? ((await prisma.family.findMany({
        where: { deletedAt: null },
        include: {
          _count: {
            select: { persons: true, branches: true, generationNames: true },
          },
        },
        orderBy: { createdAt: "asc" },
      })) as unknown as FamilyRow[])
    : ((
        await prisma.familyMember.findMany({
          where: { userId },
          include: {
            family: {
              include: {
                _count: {
                  select: {
                    persons: true,
                    branches: true,
                    generationNames: true,
                  },
                },
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        })
      ).map((m) => ({ ...m.family, myRole: m.role })) as unknown as FamilyRow[]);

  const subtreeGrants = isSuper
    ? []
    : await prisma.subtreeAdmin.findMany({
        where: { userId },
        select: {
          familyId: true,
          rootPersonId: true,
          root: { select: { name: true, generation: true } },
        },
      });

  const families: DashboardFamily[] = familiesRaw.map((f) => ({
    id: f.id,
    name: f.name,
    surname: f.surname,
    description: f.description,
    myRole: f.myRole ?? (isSuper ? "SUPERADMIN" : undefined),
    branches: f._count.branches,
    persons: f._count.persons,
    generations: f._count.generationNames,
    lastVisited: null,
  }));

  const grants: DashboardSubtreeGrant[] = subtreeGrants.map((g) => ({
    familyId: g.familyId,
    rootPersonId: g.rootPersonId,
    rootName: g.root.name,
    rootGeneration: g.root.generation,
  }));

  const totalPersons = families.reduce((s, f) => s + f.persons, 0);
  // 本月新增：从所有可见家族的 person.createdAt 拉
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const newThisMonth =
    families.length === 0
      ? 0
      : await prisma.person.count({
          where: {
            familyId: { in: families.map((f) => f.id) },
            createdAt: { gte: monthStart },
            deletedAt: null,
          },
        });

  // 最近活动：跨家族取最新 12 条
  const auditRows =
    families.length === 0
      ? []
      : await prisma.auditLog.findMany({
          where: { familyId: { in: families.map((f) => f.id) } },
          orderBy: { createdAt: "desc" },
          take: 12,
        });
  const actorIds = [...new Set(auditRows.map((a) => a.actorId))];
  const actorMap = new Map<string, string>();
  if (actorIds.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true },
    });
    for (const u of users) actorMap.set(u.id, u.name);
  }
  const familyMap = new Map(families.map((f) => [f.id, f.name]));
  const activity: DashboardActivity[] = auditRows.map((a) => ({
    id: a.id,
    familyId: a.familyId,
    familyName: familyMap.get(a.familyId) ?? "—",
    kind: a.kind,
    entity: a.entity,
    actorName: actorMap.get(a.actorId) ?? "某人",
    createdAt: a.createdAt.toISOString(),
  }));

  return {
    userName: me?.name ?? "族人",
    isSuper,
    families,
    grants,
    activity,
    totals: {
      families: families.length,
      persons: totalPersons,
      newThisMonth,
    },
  };
}

// ---------- 视图 ----------

export async function Dashboard({ data }: { data?: DashboardData } = {}) {
  const d = data ?? (await loadDashboardData());
  return <DashboardView data={d} />;
}

export function DashboardView({ data }: { data: DashboardData }) {
  const { userName, isSuper, families, grants, activity, totals } = data;
  const grantsByFamily = new Map<string, DashboardSubtreeGrant[]>();
  for (const g of grants) {
    const arr = grantsByFamily.get(g.familyId) ?? [];
    arr.push(g);
    grantsByFamily.set(g.familyId, arr);
  }

  return (
    <div className="bg-background text-foreground">
      {/* 顶部欢迎 + 概览 ------------------------------------------------- */}
      <section className="border-b border-hairline">
        <div className="mx-auto max-w-[1440px] px-3 py-8 sm:px-5 lg:px-6 lg:py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
                {greetingByHour()}
              </p>
              <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                欢迎回来，{userName}
              </h1>
              <p className="mt-1 text-sm text-fg-muted">
                {isSuper
                  ? "你以平台超管身份查看所有家族。"
                  : "继续编修你的家族故事，把它刻进时间。"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/join"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
              >
                <IconPlus size={14} />
                加入家族
              </Link>
              <Link
                href="/me"
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg shadow-sm transition hover:opacity-90"
              >
                <IconUser size={14} />
                个人设置
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <StatTile
              label={isSuper ? "全部家族" : "我的家族"}
              value={totals.families}
              icon={<IconUsers size={16} />}
              tone="brand"
            />
            <StatTile
              label="人数（合计）"
              value={totals.persons}
              icon={<IconUser size={16} />}
              tone="emerald"
            />
            <StatTile
              label="本月新增人物"
              value={totals.newThisMonth}
              icon={<IconPlus size={16} />}
              tone="amber"
              hint={
                totals.newThisMonth > 0
                  ? `共 ${totals.newThisMonth} 位族人加入家谱`
                  : "本月暂未新增"
              }
            />
          </div>
        </div>
      </section>

      {/* 主体：家族卡片 + 活动栏 ---------------------------------------- */}
      <section className="mx-auto grid max-w-[1440px] gap-6 px-3 py-8 sm:px-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-6">
        <div className="min-w-0">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {isSuper ? "全部家族" : "我的家族"}
              <span className="ml-2 text-sm font-normal text-fg-subtle">
                {families.length}
              </span>
            </h2>
            <Link
              href="/about"
              className="inline-flex items-center gap-1 text-xs text-fg-muted transition hover:text-brand"
            >
              新功能
              <IconExternalLink size={12} />
            </Link>
          </div>

          {families.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {families.map((f) => (
                <FamilyCard
                  key={f.id}
                  family={f}
                  grants={grantsByFamily.get(f.id) ?? []}
                />
              ))}
            </ul>
          )}

          <QuickActions />
        </div>

        {/* 活动 ----------------------------------------------------- */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-border bg-panel shadow-sm">
            <div className="flex items-center gap-1.5 border-b border-hairline px-4 py-3">
              <IconClock size={14} className="text-fg-subtle" />
              <h3 className="text-sm font-semibold text-foreground">
                最近活动
              </h3>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-fg-subtle">
                跨家族
              </span>
            </div>
            {activity.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-fg-subtle">
                还没有任何审计记录
              </p>
            ) : (
              <ul className="divide-y divide-hairline">
                {activity.slice(0, 8).map((a) => (
                  <ActivityItem key={a.id} item={a} />
                ))}
              </ul>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

// ---------- 子组件 ----------

function StatTile({
  label,
  value,
  icon,
  tone,
  hint,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "brand" | "emerald" | "amber";
  hint?: string;
}) {
  const toneClass: Record<typeof tone, string> = {
    brand: "bg-brand-soft text-brand-soft-fg",
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber:
      "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  };
  return (
    <div className="rounded-lg border border-border bg-panel p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fg-muted">{label}</span>
        <span
          aria-hidden
          className={`flex h-7 w-7 items-center justify-center rounded-md ${toneClass[tone]}`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        {value.toLocaleString("zh-CN")}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-fg-subtle">{hint}</div>
      )}
    </div>
  );
}

function FamilyCard({
  family,
  grants,
}: {
  family: DashboardFamily;
  grants: DashboardSubtreeGrant[];
}) {
  return (
    <li className="group relative overflow-hidden rounded-lg border border-border bg-panel shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
      <div className="relative z-0 p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand text-lg font-semibold text-brand-fg shadow-md"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {family.surname?.[0] ?? "氏"}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-foreground">
              {family.name}
            </h3>
            <p className="text-xs text-fg-subtle">
              {family.surname} 氏
              {family.myRole && (
                <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-fg-muted">
                  {roleLabel(family.myRole)}
                </span>
              )}
            </p>
          </div>
        </div>

        {family.description && (
          <p className="mt-3 line-clamp-2 text-sm text-fg-muted">
            {family.description}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <Stat label="人数" value={family.persons} />
          <Stat label="字辈" value={family.generations} />
          <Stat label="支系" value={family.branches} />
        </dl>

        {grants.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {grants.map((g) => (
              <span
                key={g.rootPersonId}
                className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                管 {g.rootName}（{g.rootGeneration} 世）
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
            进入家族
            <IconChevronRight size={14} />
          </span>
          <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
            {family.lastVisited
              ? formatRelative(family.lastVisited)
              : "尚未访问"}
          </span>
        </div>
      </div>
      {/* 整卡点击进入家族：覆盖层链接置于内容之上（内容均为非交互元素，不会被遮挡误触） */}
      <Link
        href={`/f/${family.id}`}
        className="absolute inset-0 z-10"
        aria-label={`进入家族 ${family.name}`}
      />
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted py-2">
      <div className="text-base font-semibold text-foreground">{value}</div>
      <div className="text-[10px] text-fg-subtle">{label}</div>
    </div>
  );
}

function QuickActions() {
  const actions = [
    {
      icon: IconUser,
      title: "加入新家族",
      hint: "用 8 位邀请码或邀请链接",
      href: "/join",
    },
    {
      icon: IconFileText,
      title: "导入族谱 Excel",
      hint: "支持人物 / 字辈 / 支系批量导入",
      href: "/dashboard?tip=import",
    },
    {
      icon: IconBook,
      title: "了解册谱导出",
      hint: "把电子族谱印成纸质册",
      href: "/features",
    },
  ];
  return (
    <div className="mt-8">
      <h3 className="mb-3 text-sm font-semibold text-foreground">快捷操作</h3>
      <ul className="grid gap-3 sm:grid-cols-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <li key={a.title}>
              <Link
                href={a.href}
                className="flex h-full items-start gap-2.5 rounded-lg border border-dashed border-border bg-panel p-4 transition hover:border-brand/50 hover:bg-muted"
              >
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-brand-soft text-brand-soft-fg">
                  <Icon size={15} />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {a.title}
                  </span>
                  <span className="mt-0.5 text-[11px] text-fg-subtle">
                    {a.hint}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActivityItem({ item }: { item: DashboardActivity }) {
  const tone = kindTone(item.kind);
  return (
    <li className="flex items-start gap-2.5 px-4 py-3">
      <span
        aria-hidden
        className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-md ${tone.bg} ${tone.text}`}
      >
        {entityIcon(item.entity)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          <span className="font-medium">{item.actorName}</span>
          <span className="ml-1 text-fg-muted">
            {kindLabel(item.kind)} {entityLabel(item.entity)}
          </span>
        </p>
        <p className="text-[11px] text-fg-subtle">
          <Link
            href={`/f/${item.familyId}`}
            className="hover:text-brand hover:underline"
          >
            {item.familyName}
          </Link>
          <span className="mx-1">·</span>
          {formatRelative(item.createdAt)}
        </p>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-panel p-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-soft-fg">
        <IconUsers size={28} />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">
        你还没有加入任何家族
      </p>
      <p className="mt-1 text-xs text-fg-muted">
        创建一个属于你自己的家族，或用邀请码 / 链接加入族中长辈已有的家谱
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <CreateFamilyButton label="创建一个新家族" />
        <Link
          href="/join"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          <IconPlus size={14} />
          输入邀请码加入
        </Link>
        <Link
          href="/discover"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-panel px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          浏览公开家族
        </Link>
      </div>
    </div>
  );
}

// ---------- 工具 ----------

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 5) return "深夜安好";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

function roleLabel(role: string) {
  switch (role) {
    case "OWNER":
      return "族长";
    case "ADMIN":
      return "管理员";
    case "MEMBER":
      return "成员";
    case "GUEST":
      return "访客";
    case "SUPERADMIN":
      return "超管";
    default:
      return role;
  }
}

function kindLabel(kind: string) {
  switch (kind) {
    case "CREATE":
      return "新增";
    case "UPDATE":
      return "更新";
    case "DELETE":
      return "删除";
    case "APPROVE":
      return "审核通过";
    case "REJECT":
      return "驳回";
    default:
      return kind;
  }
}

function entityLabel(entity: string) {
  switch (entity) {
    case "Person":
      return "人物";
    case "Marriage":
      return "婚配";
    case "ParentChild":
      return "亲子关系";
    case "Family":
      return "家族信息";
    case "GenerationName":
      return "字辈";
    case "Migration":
      return "迁徙";
    case "ShareLink":
      return "分享链接";
    case "ImportXlsx":
      return "Excel 导入";
    default:
      return entity;
  }
}

function entityIcon(entity: string) {
  switch (entity) {
    case "Person":
      return <IconUser size={13} />;
    case "Marriage":
    case "ParentChild":
      return <IconUsers size={13} />;
    case "Migration":
      return <IconRoute size={13} />;
    case "GenerationName":
      return <IconLineage size={13} />;
    case "ImportXlsx":
      return <IconFileText size={13} />;
    default:
      return <IconTree size={13} />;
  }
}

function kindTone(kind: string) {
  switch (kind) {
    case "CREATE":
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        text: "text-emerald-700 dark:text-emerald-300",
      };
    case "DELETE":
      return {
        bg: "bg-rose-50 dark:bg-rose-950/40",
        text: "text-rose-700 dark:text-rose-300",
      };
    case "APPROVE":
      return {
        bg: "bg-brand-soft",
        text: "text-brand-soft-fg",
      };
    case "REJECT":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/40",
        text: "text-amber-700 dark:text-amber-300",
      };
    default:
      return {
        bg: "bg-muted",
        text: "text-fg-muted",
      };
  }
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} 小时前`;
  const day = Math.round(h / 24);
  if (day < 30) return `${day} 天前`;
  return d.toLocaleDateString("zh-CN");
}
