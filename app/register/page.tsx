import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: nextRaw, error } = await searchParams;
  const next = nextRaw || "/";

  const errorMessage =
    error === "missing"
      ? "请填写完整信息"
      : error === "short"
        ? "密码至少 6 位"
        : error === "taken"
          ? "该手机号已注册"
          : error === "regfail"
            ? "注册失败，请稍后重试"
            : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <form
        method="POST"
        action="/api/register"
        className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input type="hidden" name="next" value={next} />
        <h1 className="mb-1 text-xl font-semibold">注册</h1>
        <p className="mb-5 text-sm text-zinc-500">手机号 + 密码 + 昵称</p>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-zinc-500">手机号</span>
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            placeholder="13800138000"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
            required
          />
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-zinc-500">密码</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={6}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
            required
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-zinc-500">昵称</span>
          <input
            type="text"
            name="name"
            maxLength={40}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
            required
          />
        </label>

        {errorMessage && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          注册并登录
        </button>

        <p className="mt-4 text-center text-xs text-zinc-500">
          已有账户？
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="ml-1 text-blue-600 hover:underline"
          >
            去登录
          </Link>
        </p>
      </form>
    </div>
  );
}
