"use client";

/**
 * 顶栏右侧：当前用户头像 + 下拉。
 *
 * 下拉项：个人设置、加入家族、(超管) 平台后台、退出
 * 头像：取昵称首字（中文取第一个汉字）
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  IconChevronDown,
  IconKey,
  IconLogout,
  IconShield,
  IconUser,
} from "./icons";

export function UserMenu({
  name,
  isSuper,
  logoutAction,
}: {
  name: string;
  isSuper: boolean;
  logoutAction: () => Promise<void>;
}) {
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

  const ch = (name || "我").trim()[0] ?? "我";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="用户菜单"
        className="flex items-center gap-1.5 rounded-md py-1 pl-1 pr-1.5 transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-[12px] font-semibold text-brand-fg"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {ch}
        </span>
        <span className="hidden max-w-[7rem] truncate text-sm text-foreground sm:inline">
          {name || "我"}
        </span>
        <IconChevronDown size={14} className="text-fg-subtle" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-md border border-border bg-panel py-1 text-sm shadow-lg"
        >
          <div className="px-3 pb-2 pt-2">
            <div className="text-sm font-medium text-foreground">
              {name || "我"}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-subtle">
              {isSuper ? (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  超级管理员
                </span>
              ) : (
                <span>普通用户</span>
              )}
            </div>
          </div>
          <div className="border-t border-hairline" />
          <Link
            href="/me"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-foreground transition hover:bg-muted"
          >
            <IconUser size={14} />
            个人设置
          </Link>
          <Link
            href="/me#password"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-foreground transition hover:bg-muted"
          >
            <IconKey size={14} />
            修改密码
          </Link>
          <Link
            href="/join"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-foreground transition hover:bg-muted"
          >
            <IconUser size={14} />
            加入新家族
          </Link>
          {isSuper && (
            <>
              <div className="border-t border-hairline" />
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-amber-700 transition hover:bg-muted dark:text-amber-300"
              >
                <IconShield size={14} />
                平台后台
              </Link>
            </>
          )}
          <div className="border-t border-hairline" />
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-rose-600 transition hover:bg-muted dark:text-rose-400"
            >
              <IconLogout size={14} />
              退出登录
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
