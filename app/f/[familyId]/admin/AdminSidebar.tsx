"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

export function AdminSidebar({
  familyId,
  pendingCount,
  horizontal,
}: {
  familyId: string;
  pendingCount: number;
  horizontal?: boolean;
}) {
  const pathname = usePathname();
  const root = `/f/${familyId}/admin`;

  const items: NavItem[] = [
    { href: root, label: "成员" }, // 默认页 = 成员
    { href: `${root}/invites`, label: "邀请码" },
    { href: `${root}/grants`, label: "子树管理员" },
    { href: `${root}/shares`, label: "分享链接" },
    { href: `${root}/generations`, label: "字辈表" },
    { href: `${root}/locations`, label: "居住地字典" },
    { href: `${root}/submissions`, label: "待审提交", badge: pendingCount },
    { href: `${root}/migrations`, label: "支系迁徙" },
    { href: `${root}/import`, label: "数据导入" },
    { href: `${root}/audit`, label: "审计日志" },
  ];

  if (horizontal) {
    return (
      <nav className="flex flex-wrap gap-1.5 text-xs">
        {items.map((it) => {
          const active = isActive(pathname, it.href, root);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`rounded-full border px-2.5 py-1 transition ${
                active
                  ? "border-brand bg-brand-soft text-brand-soft-fg"
                  : "border-border text-fg-muted hover:bg-muted hover:text-foreground"
              }`}
            >
              {it.label}
              {it.badge ? (
                <span className="ml-1 text-amber-600 dark:text-amber-400">
                  {it.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {items.map((it) => {
        const active = isActive(pathname, it.href, root);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center justify-between rounded-md px-3 py-1.5 transition ${
              active
                ? "bg-brand-soft font-medium text-brand-soft-fg"
                : "text-fg-muted hover:bg-muted hover:text-foreground"
            }`}
          >
            <span>{it.label}</span>
            {it.badge ? (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                {it.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function isActive(pathname: string, href: string, root: string): boolean {
  if (href === root) return pathname === root || pathname === `${root}/`;
  return pathname === href || pathname.startsWith(href + "/");
}
