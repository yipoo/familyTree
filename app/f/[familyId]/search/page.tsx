/**
 * 高级搜索页
 * 路由：/f/[familyId]/search
 *
 * SSR 拉一些选项数据（branches / generationChars），客户端组件处理输入与请求。
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { AdvancedSearchPanel } from "./AdvancedSearchPanel";

export const dynamic = "force-dynamic";

export default async function AdvancedSearchPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/f/${familyId}/search`)}`);
  }

  const family = await prisma.family.findFirst({
    where: { id: familyId, deletedAt: null },
    include: {
      generationNames: { orderBy: { generation: "asc" } },
      branches: { orderBy: { name: "asc" } },
    },
  });
  if (!family) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link
            href={`/f/${familyId}`}
            className="text-sm text-zinc-500 hover:underline"
          >
            ← 返回家族
          </Link>
          <h1 className="text-base font-semibold">{family.name} · 高级搜索</h1>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4 sm:p-8">
        <AdvancedSearchPanel
          familyId={familyId}
          branches={family.branches.map((b) => ({ id: b.id, name: b.name }))}
          generationChars={family.generationNames.map((g) => ({
            generation: g.generation,
            character: g.character,
          }))}
        />
      </main>
    </div>
  );
}
