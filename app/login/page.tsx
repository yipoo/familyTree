import Link from "next/link";

import { CodeLoginForm } from "./CodeLoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    error?: string;
    mode?: string;
    phone?: string;
  }>;
}) {
  const sp = await searchParams;
  const next = sp.next || "/";
  const mode = sp.mode === "code" ? "code" : "password";

  // ------- 验证码模式（客户端组件）-------
  if (mode === "code") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <CodeLoginForm
          next={next}
          initialPhone={sp.phone}
          initialError={codeErrorMessage(sp.error)}
        />
      </div>
    );
  }

  // ------- 密码模式（默认，纯 SSR）-------
  const errorMessage =
    sp.error === "invalid"
      ? "手机号或密码错误"
      : sp.error === "missing"
        ? "请填写手机号和密码"
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <form
        method="POST"
        action="/api/login"
        className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input type="hidden" name="next" value={next} />
        <h1 className="mb-1 text-xl font-semibold">登录</h1>
        <p className="mb-5 text-sm text-zinc-500">使用手机号 + 密码登录</p>

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
        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-zinc-500">密码</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
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
          登录
        </button>

        <div className="mt-4 flex items-center justify-between text-xs">
          <Link
            href={`/login?mode=code${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`}
            className="text-blue-600 hover:underline"
          >
            忘记密码？用验证码登录 →
          </Link>
          <Link
            href={`/register${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="text-zinc-500 hover:underline"
          >
            注册
          </Link>
        </div>
      </form>
    </div>
  );
}

function codeErrorMessage(err?: string): string | null {
  switch (err) {
    case "missing":
      return "请填写手机号和验证码";
    case "invalid_phone":
      return "手机号格式不正确";
    case "invalid_code":
      return "验证码必须是 6 位数字";
    case "no_code":
      return "请先获取验证码";
    case "expired":
      return "验证码已过期，请重新获取";
    case "mismatch":
      return "验证码错误";
    case "attempts_exceeded":
      return "尝试次数过多，请重新获取";
    case "consumed":
      return "验证码已使用，请重新获取";
    default:
      return null;
  }
}
