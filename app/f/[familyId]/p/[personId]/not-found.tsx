import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold">人物未找到</h1>
        <p className="mt-2 text-sm text-zinc-500">
          该人物不存在、已被删除，或不属于当前家族。
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
