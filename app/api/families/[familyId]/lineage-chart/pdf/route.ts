/**
 * GET /api/families/[familyId]/lineage-chart/pdf?root=PID
 *
 * 服务端生成吊线图 PDF（@react-pdf/renderer 渲染原生 SVG）。
 * 输出 application/pdf 流，浏览器直接下载。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireFamilyRole } from "@/lib/auth/guard";
import { handleApiError } from "@/lib/api/error";
import { layoutLineageChart } from "@/lib/services/lineage-chart";
import { renderLineageChartPdf } from "@/lib/pdf/lineage-chart";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const url = new URL(req.url);
    const rootParam = url.searchParams.get("root");

    const [family, persons, marriages, parentChild] = await Promise.all([
      prisma.family.findUnique({
        where: { id: familyId },
        include: {
          generationNames: { orderBy: { generation: "asc" } },
          branches: { orderBy: { name: "asc" } },
        },
      }),
      prisma.person.findMany({
        where: { familyId, deletedAt: null },
        select: {
          id: true,
          name: true,
          alias: true,
          generation: true,
          generationChar: true,
          gender: true,
          isMarriedIn: true,
          birthOrder: true,
          birthYear: true,
          deathYear: true,
          status: true,
          succession: true,
        },
      }),
      prisma.marriage.findMany({
        where: { familyId },
        select: { husbandId: true, wifeId: true, type: true, order: true },
      }),
      prisma.parentChild.findMany({
        where: { familyId },
        select: { parentId: true, childId: true, birthOrder: true },
      }),
    ]);

    if (!family) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Family not found" } },
        { status: 404 },
      );
    }

    let rootId: string | null = null;
    if (rootParam) rootId = persons.find((p) => p.id === rootParam)?.id ?? null;
    if (!rootId) rootId = family.branches[0]?.rootPersonId ?? null;
    if (!rootId) {
      const minGen = persons.reduce(
        (m, p) => Math.min(m, p.generation),
        Number.POSITIVE_INFINITY,
      );
      rootId = persons.find((p) => p.generation === minGen && p.gender === "MALE")?.id
        ?? persons.find((p) => p.generation === minGen)?.id
        ?? null;
    }
    if (!rootId) {
      return NextResponse.json(
        { error: { code: "EMPTY", message: "暂无可绘制的人物" } },
        { status: 422 },
      );
    }

    const layout = layoutLineageChart({
      rootPersonId: rootId,
      persons,
      parentChild,
      marriages,
    });

    const generationChars = Object.fromEntries(
      family.generationNames.map((g) => [g.generation, g.character]),
    );

    const rootName = persons.find((p) => p.id === rootId)?.name ?? "";

    const pdfBytes = await renderLineageChartPdf({
      title: family.name,
      subtitle: `首祖 ${rootName} 起 · 共 ${layout.generations.length} 代 · ${layout.nodes.length} 人`,
      layout,
      generationChars,
    });

    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="lineage-${family.surname}-${rootName}.pdf"`,
        "cache-control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
