/**
 * GET /api/families/[familyId]/lineage-chart/pdf?root=PID
 *
 * 兼容老链接：
 *   - 家族人数 < SYNC_PERSON_THRESHOLD：同步生成（原行为）
 *   - 否则：创建异步 PdfJob 并 303 跳转到 /pdf-jobs/<id> 状态页（前端可识别）
 *
 * 推荐新调用方走 POST /api/families/[fid]/pdf-jobs。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireFamilyRole } from "@/lib/auth/guard";
import { handleApiError } from "@/lib/api/error";
import { attachmentDisposition } from "@/lib/api/download";
import { layoutLineageChart } from "@/lib/services/lineage-chart";
import { renderLineageChartPdf } from "@/lib/pdf/lineage-chart";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import {
  createJob,
  familyPersonCount,
  SYNC_PERSON_THRESHOLD,
} from "@/lib/services/pdf-queue";

async function lineageChartPdfHandler(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    const auth = await requireFamilyRole(familyId, "MEMBER");
    const url = new URL(req.url);
    const rootParam = url.searchParams.get("root");

    // 大家族：同步生成不靠谱，转异步队列。
    const count = await familyPersonCount(familyId);
    if (count >= SYNC_PERSON_THRESHOLD) {
      const job = await createJob({
        familyId,
        type: "LINEAGE_CHART",
        requestedById: auth.user.id,
        params: rootParam ? { root: rootParam } : {},
      });
      return NextResponse.json(
        {
          data: {
            jobId: job.id,
            status: job.status,
            statusUrl: `/api/families/${familyId}/pdf-jobs/${job.id}`,
            downloadUrl: `/api/families/${familyId}/pdf-jobs/${job.id}/download`,
          },
        },
        { status: 202 },
      );
    }

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
        "content-disposition": attachmentDisposition(
          `${family.name}-吊线图-${rootName}.pdf`,
        ),
        "cache-control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

// 限流：PDF 渲染是计算密集型，每用户每分钟 5 次（异步化后此 GET 仅小家族走）
export const GET = withRateLimit(lineageChartPdfHandler, {
  bucket: "pdf-lineage",
  limit: 5,
  windowMs: 60_000,
  withUser: true,
});
