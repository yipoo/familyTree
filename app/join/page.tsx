import Link from "next/link";

import { auth } from "@/auth";
import { JoinForm } from "./JoinForm";

export const dynamic = "force-dynamic";

export default async function JoinIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await searchParams; // 仅保留参数透传
  const session = await auth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold">加入家族</h1>
        <p className="mt-1 text-sm text-zinc-500">
          输入族中长辈给你的 8 位邀请码
        </p>

        {!session?.user?.id ? (
          <Link
            href="/login?next=/join"
            className="mt-4 block w-full rounded bg-blue-600 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
          >
            先登录
          </Link>
        ) : (
          <div className="mt-4">
            <JoinForm />
          </div>
        )}

        <p className="mt-4 text-center text-xs text-zinc-400">
          已有家族？
          <Link href="/me" className="ml-1 text-blue-600 hover:underline">
            查看我的家族
          </Link>
        </p>
      </div>
    </div>
  );
}
