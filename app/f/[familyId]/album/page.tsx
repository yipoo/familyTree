/**
 * 册谱（傳統紙質族譜的網頁版）
 *
 * 路由：/f/[familyId]/album
 *
 * 内容布局（亦同步用于 PDF）：
 *   1. 封面：家族名 / 始祖 / 生成时间
 *   2. 序：description / 字辈表
 *   3. 各卷（按支系分卷）
 *      - 章（按世代）
 *        - 人物条目（传记体文字）
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildAlbumBook, formatPersonEntryText } from "@/lib/services/album";
import { AlbumPrintActions } from "./AlbumPrintActions";

export const dynamic = "force-dynamic";

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/f/${familyId}/album`)}`);
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true },
  });
  const member = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId: session.user.id, familyId } },
    select: { role: true },
  });
  if (!member && me?.platformRole !== "SUPERADMIN") {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <h1 className="text-lg font-semibold">无权访问</h1>
      </div>
    );
  }

  const book = await buildAlbumBook(familyId);
  if (!book) notFound();

  const pageStyle =
    "rounded-lg bg-white px-8 py-10 text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100 print:shadow-none print:rounded-none";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 print:bg-white">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 sm:px-8 print:hidden">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <Link
            href={`/f/${familyId}`}
            className="text-sm text-zinc-500 hover:underline"
          >
            ← 返回家族
          </Link>
          <h1 className="text-base font-semibold">{book.family.name} · 册谱</h1>
          <span className="ml-auto text-xs text-zinc-500">
            共 {book.totalPersons} 人 · {book.volumes.length} 卷
          </span>
          <AlbumPrintActions familyId={familyId} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-8 print:max-w-none print:p-0">
        {/* 封面 */}
        <section className={`${pageStyle} text-center`}>
          <p className="text-sm text-zinc-500">{book.family.surname} 氏家族</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-wider">
            {book.family.name}
          </h2>
          {book.family.founderName && (
            <p className="mt-2 text-sm">始祖 · {book.family.founderName}</p>
          )}
          <p className="mt-8 text-xs text-zinc-500">
            生成于 {new Date(book.generatedAt).toLocaleString("zh-CN")}
          </p>
        </section>

        {/* 序 */}
        {(book.family.description || book.generationNames.length > 0) && (
          <section className={pageStyle}>
            <h3 className="mb-3 text-lg font-semibold">序</h3>
            {book.family.description && (
              <p className="whitespace-pre-wrap leading-7 text-sm">
                {book.family.description}
              </p>
            )}
            {book.generationNames.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-medium">字辈表</h4>
                <div className="flex flex-wrap gap-1.5 text-sm">
                  {book.generationNames.map((g) => (
                    <span
                      key={g.generation}
                      className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      <span className="text-zinc-500">{g.generation}世</span>
                      <span className="ml-1 font-semibold">{g.character}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 各卷 */}
        {book.volumes.map((vol, vi) => (
          <section key={vol.branchId ?? "_no"} className={pageStyle}>
            <h3 className="mb-1 text-lg font-semibold">
              卷之{["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][vi] ?? vi + 1}
              　{vol.branchName}
            </h3>
            <p className="mb-4 text-xs text-zinc-500">收录 {vol.count} 人</p>
            <div className="space-y-6">
              {vol.chapters.map((ch) => (
                <div key={ch.generation}>
                  <h4 className="mb-2 border-b border-zinc-200 pb-1 text-base font-medium dark:border-zinc-700">
                    第 {ch.generation} 世
                    {ch.generationChar && `·${ch.generationChar}`}
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      {ch.entries.length} 人
                    </span>
                  </h4>
                  <ol className="space-y-3">
                    {ch.entries.map((e, ei) => (
                      <li
                        key={e.id}
                        className="text-sm leading-7"
                        style={{ textIndent: "2em" }}
                      >
                        <span className="mr-1 text-xs text-zinc-400">{ei + 1}.</span>
                        {formatPersonEntryText(e)}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
              {vol.chapters.length === 0 && (
                <p className="text-sm text-zinc-500">本卷暂无人物</p>
              )}
            </div>
          </section>
        ))}

        {/* 跋 */}
        <section className={`${pageStyle} text-center text-xs text-zinc-500`}>
          ——本册谱由家谱系统自动生成，记录共 {book.totalPersons} 位族人——
        </section>
      </main>
    </div>
  );
}
