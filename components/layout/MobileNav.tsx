"use client";

/**
 * 移动端抽屉：汉堡按钮 + 全屏侧拉抽屉。
 * 内含：家族切换、视图导航、用户区入口。
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  IconChevronRight,
  IconClose,
  IconMenu,
} from "./icons";
import { resolveIcon, type ViewTab } from "./ViewTabs";
import type { SwitcherFamily } from "./FamilySwitcher";

export function MobileNav({
  current,
  memberships,
  tabs,
}: {
  current: SwitcherFamily | null;
  memberships: SwitcherFamily[];
  tabs: ViewTab[];
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  // 用「派生 state + setState-in-render」官方推荐写法关闭抽屉，避免 effect 级联渲染
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (open) setOpen(false);
  }

  // ESC 关闭 + 锁滚
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="打开导航"
        className="flex h-9 w-9 items-center justify-center rounded-md text-fg-muted transition hover:bg-muted hover:text-foreground md:hidden"
      >
        <IconMenu size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          {/* backdrop */}
          <button
            type="button"
            aria-label="关闭"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />
          {/* drawer */}
          <div className="absolute inset-y-0 left-0 flex w-[84%] max-w-sm flex-col bg-panel shadow-xl">
            <div className="flex h-12 items-center justify-between border-b border-hairline px-4">
              <span className="text-sm font-semibold text-foreground">
                导航
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭"
                className="flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition hover:bg-muted hover:text-foreground"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3">
              {memberships.length > 0 && (
                <section className="mb-4">
                  <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
                    我的家族
                  </div>
                  <ul>
                    {memberships.map((f) => {
                      const active = f.id === current?.id;
                      return (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              router.push(`/f/${f.id}`);
                            }}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                              active
                                ? "bg-brand-soft text-brand-soft-fg"
                                : "text-foreground hover:bg-muted"
                            }`}
                          >
                            <span
                              aria-hidden
                              className={`flex h-7 w-7 items-center justify-center rounded-md text-[12px] font-semibold ${
                                active
                                  ? "bg-brand text-brand-fg"
                                  : "bg-muted text-fg-muted"
                              }`}
                              style={{ fontFamily: "var(--font-serif)" }}
                            >
                              {f.surname?.[0] ?? "氏"}
                            </span>
                            <span className="flex flex-col">
                              <span className="font-medium">{f.name}</span>
                              <span className="text-[11px] text-fg-subtle">
                                {f.surname} 氏
                              </span>
                            </span>
                            {active && (
                              <IconChevronRight size={14} className="ml-auto" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {current && tabs.length > 0 && (
                <section className="mb-4">
                  <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
                    {current.name} 视图
                  </div>
                  <ul>
                    {tabs.map((t) => {
                      const active = isActive(pathname, t.href, t.exact);
                      const Icon = resolveIcon(t.icon);
                      return (
                        <li key={t.href}>
                          <Link
                            href={t.href}
                            className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm transition ${
                              active
                                ? "bg-brand-soft text-brand-soft-fg"
                                : "text-foreground hover:bg-muted"
                            }`}
                          >
                            <Icon size={15} />
                            <span>{t.label}</span>
                            {t.badge ? (
                              <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-none text-white">
                                {t.badge}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <section>
                <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
                  账户
                </div>
                <ul className="text-sm">
                  <li>
                    <Link
                      href="/dashboard"
                      className="block rounded-md px-2 py-2 text-foreground transition hover:bg-muted"
                    >
                      我的家族
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/me"
                      className="block rounded-md px-2 py-2 text-foreground transition hover:bg-muted"
                    >
                      个人设置
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/join"
                      className="block rounded-md px-2 py-2 text-foreground transition hover:bg-muted"
                    >
                      加入家族
                    </Link>
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(href + "/");
}
