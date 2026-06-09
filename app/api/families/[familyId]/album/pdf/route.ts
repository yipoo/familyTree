/**
 * GET /api/families/[familyId]/album/pdf
 *
 * 兼容老链接：
 *   - 小家族：同步渲染并下载（原行为）
 *   - 大家族：创建异步 PdfJob，202 + 状态/下载 URL
 */
import { NextResponse } from "next/server";

import { requireFamilyRole } from "@/lib/auth/guard";
import { handleApiError } from "@/lib/api/error";
import { buildAlbumBook } from "@/lib/services/album";
import { renderAlbumPdf } from "@/lib/pdf/album";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import {
  createJob,
  familyPersonCount,
  SYNC_PERSON_THRESHOLD,
} from "@/lib/services/pdf-queue";

async function albumPdfHandler(
  _req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    const auth = await requireFamilyRole(familyId, "MEMBER");

    const count = await familyPersonCount(familyId);
    if (count >= SYNC_PERSON_THRESHOLD) {
      const job = await createJob({
        familyId,
        type: "ALBUM",
        requestedById: auth.user.id,
        params: {},
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

    const book = await buildAlbumBook(familyId, { withLineage: true });
    if (!book) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Family not found" } },
        { status: 404 },
      );
    }
    const buf = await renderAlbumPdf(book);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="album-${book.family.surname}-${book.family.name}.pdf"`,
        "cache-control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

// 限流：PDF 渲染是计算密集型，每用户每分钟 5 次（异步化后此 GET 仅小家族走）
export const GET = withRateLimit(albumPdfHandler, {
  bucket: "pdf-album",
  limit: 5,
  windowMs: 60_000,
  withUser: true,
});
