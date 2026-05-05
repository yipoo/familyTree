/**
 * 高级搜索页
 * 路由：/f/[familyId]/search
 *
 * SSR 拉一些选项数据（branches / generationChars），客户端组件处理输入与请求。
 */
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
    <div>
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
              高级搜索
            </p>
            <h1 className="mt-1 font-serif text-xl font-semibold text-foreground">
              {family.name}
            </h1>
            <p className="mt-0.5 text-xs text-fg-muted">
              按姓名 / 字辈 / 支系 / 居住地 / 在世状态 等多条件检索
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
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
