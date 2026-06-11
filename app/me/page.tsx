import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";
import { CancelJoinRequestButton } from "./CancelJoinRequestButton";

import {
  IconClock,
  IconKey,
  IconShield,
  IconUser,
  IconUsers,
} from "@/components/layout/icons";

export const dynamic = "force-dynamic";

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const sp = await searchParams;
  const welcome = sp.welcome === "1";

  const session = await auth();
  const userId = session!.user.id;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      platformRole: true,
      createdAt: true,
    },
  });

  const [memberships, grants, joinRequests] = await Promise.all([
    prisma.familyMember.findMany({
      where: { userId },
      include: {
        family: { select: { id: true, name: true, surname: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.subtreeAdmin.findMany({
      where: { userId },
      include: {
        family: { select: { id: true, name: true } },
        root: { select: { id: true, name: true, generation: true } },
        grantedBy: { select: { name: true } },
      },
      orderBy: { grantedAt: "desc" },
    }),
    prisma.joinRequest.findMany({
      where: {
        userId,
        // 已批准的会同时变成 FamilyMember，列在"我的家族"里就够了；这里只列未完成 / 历史拒绝
        status: { in: ["PENDING", "REJECTED", "CANCELLED"] },
      },
      include: {
        family: { select: { id: true, name: true, surname: true, isPublic: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
  ]);

  const ch = (me?.name ?? "我").trim()[0] ?? "我";

  return (
    <div className="bg-background text-foreground">
      {/* 顶部 hero —— 用户名片 */}
      <section className="border-b border-hairline">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-3 py-8 sm:px-5 lg:px-6">
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand text-2xl font-semibold text-brand-fg shadow-md"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {ch}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
              {me?.name ?? "—"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              <span className="font-mono">{maskPhone(me?.phone ?? "")}</span>
              {me?.platformRole === "SUPERADMIN" && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  <IconShield size={11} />
                  超级管理员
                </span>
              )}
              {me?.createdAt && (
                <span>
                  注册于{" "}
                  {new Date(me.createdAt).toLocaleDateString("zh-CN")}
                </span>
              )}
            </div>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            返回仪表盘
          </Link>
        </div>
      </section>

      <main className="mx-auto max-w-[1440px] space-y-6 px-3 py-8 sm:px-5 lg:px-6">
        {welcome && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
            <strong className="text-emerald-900 dark:text-emerald-200">
              欢迎，{me?.name}！
            </strong>
            <p className="mt-1 text-emerald-700 dark:text-emerald-300">
              账号已创建。要查看家谱，请向族中长辈索取邀请码或邀请链接。
            </p>
            <Link
              href="/join"
              className="mt-2 inline-block rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              输入邀请码加入家族 →
            </Link>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          {/* 基本信息 */}
          <CardSection title="基本信息" icon={<IconUser size={14} />}>
            <dl className="mb-4 grid grid-cols-[80px_1fr] gap-y-1.5 text-sm">
              <dt className="text-fg-subtle">手机号</dt>
              <dd className="font-mono text-foreground">
                {me?.phone ?? "—"}
              </dd>
              <dt className="text-fg-subtle">注册时间</dt>
              <dd className="text-fg-muted">
                {me?.createdAt
                  ? new Date(me.createdAt).toLocaleString("zh-CN")
                  : "—"}
              </dd>
            </dl>
            <ProfileForm initialName={me?.name ?? ""} />
          </CardSection>

          {/* 修改密码 */}
          <CardSection
            title="修改密码"
            icon={<IconKey size={14} />}
            anchor="password"
          >
            <PasswordForm />
          </CardSection>
        </div>

        {/* 我的家族 */}
        <CardSection
          title={`我的家族（${memberships.length}）`}
          icon={<IconUsers size={14} />}
        >
          {memberships.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted p-4 text-sm">
              <p className="text-foreground">你还没有加入任何家族。</p>
              <p className="mt-1 text-xs text-fg-subtle">
                请向族中长辈索取邀请码或邀请链接。
              </p>
              <Link
                href="/join"
                className="mt-3 inline-block rounded bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg transition hover:opacity-90"
              >
                输入邀请码加入 →
              </Link>
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {memberships.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/f/${m.family.id}`}
                    className="flex items-center gap-2.5 rounded-md border border-border bg-panel p-3 transition hover:border-brand/40 hover:bg-muted"
                  >
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-[12px] font-semibold text-brand-fg"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {m.family.surname?.[0] ?? "氏"}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {m.family.name}
                      </span>
                      <span className="text-[11px] text-fg-subtle">
                        {m.family.surname} 氏
                      </span>
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-fg-muted">
                      {roleLabel(m.role)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardSection>

        {/* 我的入族申请 */}
        {joinRequests.length > 0 && (
          <CardSection
            title={`我的入族申请（${joinRequests.length}）`}
            icon={<IconClock size={14} />}
            desc="向公开家族发起的申请。批准后会自动加入「我的家族」。"
          >
            <ul className="divide-y divide-hairline">
              {joinRequests.map((r) => {
                const pending = r.status === "PENDING";
                const rejected = r.status === "REJECTED";
                const cancelled = r.status === "CANCELLED";
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/f/${r.family.id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {r.family.name}
                        </Link>
                        <span className="text-xs text-fg-subtle">
                          {r.family.surname} 氏
                        </span>
                        <JoinStatusBadge status={r.status} />
                      </div>
                      {r.message && (
                        <p className="mt-1 text-xs text-fg-muted">
                          留言：<span className="whitespace-pre-wrap">{r.message}</span>
                        </p>
                      )}
                      {(rejected || cancelled) && r.decidedNote && (
                        <p className="mt-1 text-xs text-fg-subtle italic">
                          {rejected ? "拒绝备注：" : "撤回备注："}
                          {r.decidedNote}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-fg-subtle">
                        {pending
                          ? `提交于 ${new Date(r.createdAt).toLocaleString("zh-CN")}`
                          : `${
                              rejected ? "被拒于" : cancelled ? "撤回于" : ""
                            } ${
                              r.decidedAt
                                ? new Date(r.decidedAt).toLocaleString("zh-CN")
                                : "—"
                            }`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {pending && (
                        <CancelJoinRequestButton
                          familyId={r.family.id}
                          id={r.id}
                          familyName={r.family.name}
                        />
                      )}
                      {(rejected || cancelled) && r.family.isPublic && (
                        <Link
                          href="/discover"
                          className="rounded-md border border-border px-2.5 py-1 text-xs text-fg-muted hover:bg-muted hover:text-foreground"
                        >
                          重新申请
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardSection>
        )}

        {/* 子树授权 */}
        <CardSection
          title={`我管理的子树（${grants.length}）`}
          icon={<IconShield size={14} />}
          desc="这些是其他管理员授权给你的「某人 + 父系后代」写权限。"
        >
          {grants.length === 0 ? (
            <p className="text-sm text-fg-subtle">暂无</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {grants.map((g) => (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/f/${g.family.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {g.family.name}
                    </Link>
                    <span className="ml-2 text-foreground">{g.root.name}</span>
                    <span className="ml-1.5 text-xs text-fg-subtle">
                      第 {g.root.generation} 世
                    </span>
                  </div>
                  <div className="text-xs text-fg-subtle">
                    由 {g.grantedBy.name} 授权 ·{" "}
                    {new Date(g.grantedAt).toLocaleDateString("zh-CN")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardSection>
      </main>
    </div>
  );
}

function CardSection({
  title,
  icon,
  desc,
  children,
  anchor,
}: {
  title: string;
  icon?: React.ReactNode;
  desc?: string;
  children: React.ReactNode;
  anchor?: string;
}) {
  return (
    <section
      id={anchor}
      className="rounded-lg border border-border bg-panel p-5 shadow-sm"
    >
      <header className="mb-3 flex items-center gap-1.5">
        {icon && <span className="text-fg-subtle">{icon}</span>}
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </header>
      {desc && <p className="mb-3 text-xs text-fg-muted">{desc}</p>}
      {children}
    </section>
  );
}

function JoinStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: {
      label: "待审批",
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    },
    REJECTED: {
      label: "已拒绝",
      cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    },
    CANCELLED: {
      label: "已撤回",
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

function maskPhone(phone: string) {
  if (!phone) return "—";
  if (phone.length < 8) return phone;
  return phone.slice(0, 3) + " **** " + phone.slice(-4);
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
    default:
      return role;
  }
}
