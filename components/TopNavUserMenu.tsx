"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function TopNavUserMenu({
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
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <span className="hidden max-w-[8rem] truncate sm:inline">{name}</span>
        {isSuper && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            超管
          </span>
        )}
        <span className="text-xs text-zinc-400">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <Link
            href="/me"
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            个人设置
          </Link>
          <Link
            href="/join"
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            加入家族
          </Link>
          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
          <form action={logoutAction}>
            <button
              type="submit"
              className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-zinc-100 dark:text-red-400 dark:hover:bg-zinc-800"
            >
              退出登录
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
