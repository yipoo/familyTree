import type { ReactNode } from "react";

/**
 * "现在"时间戳读取入口。
 *
 * Server / Client 组件渲染期不允许调用 Date.now()（react-hooks/purity）。
 * 凡需要"当前时刻"的派生（如过期与否），都先在 async 数据准备阶段拿到 now 字面值，
 * 再由纯组件（接受派生状态）渲染。
 *
 * 此函数本身不在 React 组件 / hook 中——React Compiler 不会把它视为渲染纯度的一部分。
 */
export function readNow(): number {
  return Date.now();
}

/** 从 Date 派生过期状态——纯函数，可在数据准备阶段调用。 */
export type ExpiryStatus =
  | { kind: "never" }
  | { kind: "expired"; date: string }
  | { kind: "active"; days: number; date: string };

export function computeExpiryStatus(
  expiresAt: Date | null,
  nowMs: number,
): ExpiryStatus {
  if (!expiresAt) return { kind: "never" };
  const ms = expiresAt.getTime() - nowMs;
  if (ms < 0) return { kind: "expired", date: formatDate(expiresAt) };
  return {
    kind: "active",
    days: Math.ceil(ms / 86400000),
    date: formatDate(expiresAt),
  };
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    OWNER: {
      label: "族长",
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    },
    ADMIN: {
      label: "管理员",
      cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    },
    MEMBER: {
      label: "成员",
      cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    },
    GUEST: {
      label: "访客",
      cls: "bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-500",
    },
  };
  const m = map[role] ?? { label: role, cls: "bg-zinc-100" };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

export function roleZh(r: string): string {
  return (
    {
      OWNER: "族长",
      ADMIN: "管理员",
      MEMBER: "成员",
      GUEST: "访客",
    } as Record<string, string>
  )[r] ?? r;
}

/**
 * 纯展示组件：完全由 status 决定输出，渲染期不读取时钟。
 * 如需向后兼容旧调用方式（直接传 Date），新增的便捷包装见 ExpiryLabelFromDate。
 */
export function ExpiryLabel({ status }: { status: ExpiryStatus }): ReactNode {
  if (status.kind === "never")
    return <span className="text-zinc-400">永不过期</span>;
  if (status.kind === "expired")
    return (
      <span className="text-red-600 dark:text-red-400">
        已过期 · {status.date}
      </span>
    );
  return (
    <span className="text-zinc-600 dark:text-zinc-400">
      {status.days} 天后 · {status.date}
    </span>
  );
}

export function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  if (phone.length !== 11) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}

export function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** 通用页面壳：标题 + 描述 + 内容 */
export function AdminSection({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
