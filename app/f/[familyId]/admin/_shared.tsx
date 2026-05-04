import type { ReactNode } from "react";

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

export function ExpiryLabel({ d }: { d: Date | null }): ReactNode {
  if (!d) return <span className="text-zinc-400">永不过期</span>;
  const ms = d.getTime() - Date.now();
  if (ms < 0)
    return (
      <span className="text-red-600 dark:text-red-400">
        已过期 · {formatDate(d)}
      </span>
    );
  const days = Math.ceil(ms / 86400000);
  return (
    <span className="text-zinc-600 dark:text-zinc-400">
      {days} 天后 · {formatDate(d)}
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
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
