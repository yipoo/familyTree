/**
 * /discover —— 公开发现页。
 *
 * 列出所有 Family.isPublic = true 的家族。无需登录可访问；提供搜索框 + 卡片列表。
 */
import Link from "next/link";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: qRaw } = await searchParams;
  const q = (qRaw ?? "").trim();
  const where: Record<string, unknown> = { isPublic: true, deletedAt: null };
  if (q) {
    where.OR = [
      { surname: { contains: q } },
      { name: { contains: q } },
      { description: { contains: q } },
    ];
  }
  const families = await prisma.family.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      surname: true,
      name: true,
      founderName: true,
      description: true,
      _count: { select: { persons: true, members: true, branches: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          发现公开家族
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          这里列出所有由族长 / 管理员设为公开的家族。点开看其族谱、字辈、统计与册谱。
        </p>
      </header>

      <form
        method="get"
        action="/discover"
        className="mb-6 flex max-w-md items-center gap-2"
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="搜索姓氏 / 家族名 / 描述"
          className="flex-1 rounded-md border border-border bg-panel px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg hover:opacity-90"
        >
          搜索
        </button>
      </form>

      {families.length === 0 ? (
        <p className="rounded border border-dashed border-border px-4 py-12 text-center text-sm text-fg-muted">
          {q ? `没有匹配「${q}」的公开家族。` : "暂无公开家族。"}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {families.map((f) => (
            <li
              key={f.id}
              className="rounded-lg border border-border bg-panel p-4 transition hover:shadow-md"
            >
              <Link href={`/f/${f.id}`} className="block">
                <h2 className="text-base font-semibold text-foreground">
                  {f.surname}氏 · {f.name}
                </h2>
                {f.founderName && (
                  <p className="mt-1 text-xs text-fg-muted">
                    始祖：{f.founderName}
                  </p>
                )}
                {f.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-fg-muted">
                    {f.description}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-fg-muted">
                  <span>{f._count.persons} 人</span>
                  <span>{f._count.branches} 支</span>
                  <span>{f._count.members} 成员</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
