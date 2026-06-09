/**
 * 某种体例下的"翻书"阅读页。
 *
 * /album/[style]，style ∈ diejii | ouyang | su | pagoda
 * 未知 style → 404。
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildAlbumBook } from "@/lib/services/album";

import { BookViewer } from "@/components/album/BookViewer";
import { buildDiejiiPages } from "@/components/album/DiejiPages";
import { buildOuyangPages } from "@/components/album/OuyangPages";
import { buildSuPages } from "@/components/album/SuPages";
import { buildPagodaPages } from "@/components/album/PagodaPages";
import {
  buildCompletePages,
  buildFrontMatterPages,
  type ComplianceMember,
  type PortraitEntry,
} from "@/components/album/CompletePages";
import { offsetIndex, type AlbumBuild } from "@/components/album/album-index";
import { AlbumPrintActions } from "../AlbumPrintActions";

export const dynamic = "force-dynamic";

const STYLE_LABEL: Record<string, string> = {
  complete: "合编本",
  diejii: "牒记式",
  ouyang: "欧式",
  su: "苏式",
  pagoda: "宝塔式",
};

export default async function AlbumStylePage({
  params,
}: {
  params: Promise<{ familyId: string; style: string }>;
}) {
  const { familyId, style } = await params;
  if (!STYLE_LABEL[style]) notFound();

  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/login?next=${encodeURIComponent(`/f/${familyId}/album/${style}`)}`,
    );
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

  let build: AlbumBuild;
  if (style === "diejii") {
    build = buildDiejiiPages(book);
  } else {
    // 树状 + 合编本都需要原始 person/parentChild/marriage 数据
    const [persons, parentChild, marriages] = await Promise.all([
      prisma.person.findMany({
        where: { familyId, deletedAt: null },
        select: {
          id: true,
          name: true,
          alias: true,
          gender: true,
          generation: true,
          generationChar: true,
          birthOrder: true,
          birthYear: true,
          deathYear: true,
          isMarriedIn: true,
        },
      }),
      prisma.parentChild.findMany({
        where: { familyId },
        select: { parentId: true, childId: true, birthOrder: true },
      }),
      prisma.marriage.findMany({
        where: { familyId },
        select: { husbandId: true, wifeId: true, type: true, order: true },
      }),
    ]);
    const treeInput = { book, persons, parentChild, marriages };
    if (style === "ouyang") build = buildOuyangPages(treeInput);
    else if (style === "su") build = buildSuPages(treeInput);
    else if (style === "pagoda") build = buildPagodaPages(treeInput);
    else {
      // 合编本：再多查"修谱人员"与"含头像 / 传略的人物"
      const [memberRows, portraitPersons] = await Promise.all([
        prisma.familyMember.findMany({
          where: { familyId, role: { in: ["OWNER", "ADMIN"] } },
          include: { user: { select: { name: true } } },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        }),
        prisma.person.findMany({
          where: {
            familyId,
            deletedAt: null,
            avatarUrl: { not: null },
          },
          select: {
            id: true,
            name: true,
            generation: true,
            generationChar: true,
            avatarUrl: true,
            biography: true,
          },
          orderBy: [{ generation: "asc" }, { birthOrder: "asc" }],
          take: 60,
        }),
      ]);
      const members: ComplianceMember[] = memberRows.map((m) => ({
        name: m.user.name,
        role: m.role as ComplianceMember["role"],
        joinedAt: m.joinedAt,
      }));
      const portraits: PortraitEntry[] = portraitPersons
        .filter((p): p is typeof p & { avatarUrl: string } => !!p.avatarUrl)
        .map((p) => ({
          id: p.id,
          name: p.name,
          generation: p.generation,
          generationChar: p.generationChar,
          avatarUrl: p.avatarUrl,
          biography: p.biography,
        }));
      build = buildCompletePages({ ...treeInput, members, portraits });
    }
  }

  // 非合编本体例：把 appliesTo 含本体例的前置内容（封面/谱序/凡例…）prepend 到正文前。
  // 合编本自身已含完整前置内容，故跳过。
  if (style !== "complete") {
    const frontMatter = buildFrontMatterPages(book, style);
    if (frontMatter.length > 0) {
      build = {
        pages: [...frontMatter, ...build.pages],
        index: offsetIndex(build.index, frontMatter.length),
      };
    }
  }

  return (
    <div className="bg-gradient-to-b from-zinc-100 to-zinc-200 text-foreground dark:from-zinc-950 dark:to-zinc-900">
      <header className="border-b border-hairline bg-surface/80 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-3 px-3 py-4 sm:px-5 lg:px-6">
          <div>
            <Link
              href={`/f/${familyId}/album`}
              className="text-xs text-fg-muted hover:text-foreground"
            >
              ← 返回册谱选体例
            </Link>
            <h1 className="mt-1 font-serif text-lg font-semibold text-foreground">
              {book.family.name} ·{" "}
              <span className="text-brand">{STYLE_LABEL[style]}</span>
            </h1>
          </div>
          <AlbumPrintActions familyId={familyId} />
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-3 py-8 sm:px-5 lg:px-6 print:max-w-none print:px-0 print:py-0">
        <BookViewer
          pages={build.pages}
          index={build.index}
          bookTitle={`${book.family.name} · ${STYLE_LABEL[style]}`}
        />
      </main>
    </div>
  );
}

