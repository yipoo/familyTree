/**
 * 营销页（/、/pricing、/features、/about）专用顶部导航。
 *
 * - 与 TopNav 互斥：TopNav 已把这些路径加入 PUBLIC_EXACT 跳过
 * - 已登录用户看到"进入家族"，未登录看到"登录 / 免费注册"
 * - 半透明 + 毛玻璃，stick 顶部
 */
import Link from "next/link";

import { auth } from "@/auth";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/features", label: "功能" },
  { href: "/pricing", label: "价格" },
  { href: "/about", label: "故事 & 路线图" },
];

export async function MarketingNav({ active }: { active?: string }) {
  const session = await auth();
  const loggedIn = Boolean(session?.user?.id);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/60 bg-stone-50/85 backdrop-blur-md dark:border-stone-800/60 dark:bg-stone-950/85">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <SealLogo />
          <span className="font-serif text-base font-semibold tracking-wide text-stone-900 dark:text-stone-50">
            族谱·家
          </span>
          <span className="hidden rounded bg-rose-700/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-rose-700 dark:bg-rose-400/15 dark:text-rose-300 sm:inline-block">
            BETA
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded px-3 py-1.5 text-sm transition ${
                  isActive
                    ? "bg-stone-900/5 font-medium text-stone-900 dark:bg-stone-50/10 dark:text-stone-50"
                    : "text-stone-600 hover:bg-stone-900/5 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-50/10 dark:hover:text-stone-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="rounded bg-stone-900 px-3.5 py-1.5 text-sm font-medium text-stone-50 transition hover:bg-stone-800 dark:bg-stone-50 dark:text-stone-900 dark:hover:bg-stone-200"
            >
              进入我的家族 →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded px-3 py-1.5 text-sm text-stone-600 transition hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-50 sm:inline-block"
              >
                登录
              </Link>
              <Link
                href="/register"
                className="rounded bg-rose-700 px-3.5 py-1.5 text-sm font-medium text-rose-50 shadow-sm transition hover:bg-rose-800"
              >
                免费注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function SealLogo() {
  return (
    <span
      aria-hidden
      className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-rose-700 font-serif text-xs font-bold text-rose-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]"
    >
      族
    </span>
  );
}
