"use client";

/**
 * 顶栏家族切换器：当前家族头像 + 名称，点击下拉显示我加入的所有家族 + 切换。
 *
 * - 仅 1 个家族时：作为 "返回家族首页" 链接，无下拉
 * - >= 2 个家族时：下拉列出全部，含字辈数、人数提示
 * - 兼容超管：可能列出 / 显示当前 URL 指向但未加入的家族
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { IconChevronDown, IconCheck, IconUsers } from "./icons";

export interface SwitcherFamily {
  id: string;
  name: string;
  surname: string;
  myRole?: string | null;
}

export function FamilySwitcher({
  current,
  memberships,
}: {
  current: SwitcherFamily;
  memberships: SwitcherFamily[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const others = memberships.filter((m) => m.id !== current.id);
  const noSwitch = others.length === 0;

  const trigger = (
    <span className="flex min-w-0 items-center gap-2">
      <FamilyBadge surname={current.surname} />
      <span className="flex min-w-0 flex-col items-start leading-tight">
        <span className="max-w-[10rem] truncate text-sm font-semibold text-foreground sm:max-w-[14rem]">
          {current.name}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
          {current.surname} 氏
        </span>
      </span>
      {!noSwitch && (
        <IconChevronDown size={14} className="shrink-0 text-fg-subtle" />
      )}
    </span>
  );

  if (noSwitch) {
    return (
      <Link
        href={`/f/${current.id}`}
        className="flex items-center rounded-md px-1.5 py-1 transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {trigger}
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center rounded-md px-1.5 py-1 transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-md border border-border bg-panel py-1 text-sm shadow-lg"
        >
          <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
            我的家族 · {memberships.length}
          </div>
          <ul className="max-h-80 overflow-y-auto py-0.5">
            {memberships.map((f) => {
              const active = f.id === current.id;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      setOpen(false);
                      if (!active) router.push(`/f/${f.id}`);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-muted"
                  >
                    <FamilyBadge surname={f.surname} />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate font-medium text-foreground">
                        {f.name}
                      </span>
                      <span className="text-[11px] text-fg-subtle">
                        {f.surname} 氏
                        {f.myRole && (
                          <span className="ml-1.5 rounded bg-muted px-1 py-px text-[10px] text-fg-muted">
                            {roleLabel(f.myRole)}
                          </span>
                        )}
                      </span>
                    </span>
                    {active && <IconCheck size={14} className="text-brand" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-0.5 border-t border-hairline">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-fg-muted transition hover:bg-muted hover:text-foreground"
            >
              <IconUsers size={14} />
              查看全部家族
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function FamilyBadge({ surname }: { surname: string }) {
  const ch = surname?.[0] ?? "氏";
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand text-[13px] font-semibold text-brand-fg shadow-sm"
      style={{ fontFamily: "var(--font-serif)" }}
    >
      {ch}
    </span>
  );
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
