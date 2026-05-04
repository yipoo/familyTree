import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?next=/admin");

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, platformRole: true },
  });
  if (me?.platformRole !== "SUPERADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-lg font-semibold">无权访问</h1>
          <p className="mt-2 text-sm text-zinc-500">
            该页面仅限 SUPERADMIN 平台管理员访问。
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "概览" },
    { href: "/admin/users", label: "用户" },
    { href: "/admin/families", label: "家族" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-6">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              SUPERADMIN
            </span>
            <span className="text-base font-semibold">管理后台</span>
          </Link>
          <nav className="flex gap-1 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/" className="text-zinc-500 hover:underline">
              ← 回应用
            </Link>
            <span className="text-zinc-700 dark:text-zinc-300">{me.name}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
