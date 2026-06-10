/**
 * GET /api/families/[familyId]/pdf-jobs/[jobId]/download
 *
 * 拉取 DONE 状态任务的 PDF 字节。其他状态返回 409。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireFamilyRole } from "@/lib/auth/guard";
import { handleApiError, notFound } from "@/lib/api/error";
import { attachmentDisposition } from "@/lib/api/download";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; jobId: string }> },
) {
  const { familyId, jobId } = await ctx.params;
  try {
    const auth = await requireFamilyRole(familyId, "MEMBER");
    const job = await prisma.pdfJob.findFirst({
      where: { id: jobId, familyId },
      select: {
        id: true,
        status: true,
        outputBytes: true,
        outputName: true,
        requestedById: true,
      },
    });
    if (!job) return notFound("任务不存在");

    const isAdmin =
      auth.role === "OWNER" ||
      auth.role === "ADMIN" ||
      auth.user.platformRole === "SUPERADMIN";
    if (!isAdmin && job.requestedById !== auth.user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "无权下载此任务" } },
        { status: 403 },
      );
    }

    if (job.status !== "DONE" || !job.outputBytes) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_READY",
            message: `任务尚未完成（当前 ${job.status}）`,
          },
        },
        { status: 409 },
      );
    }

    const filename = job.outputName ?? `pdf-${job.id}.pdf`;
    return new NextResponse(new Uint8Array(job.outputBytes), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": attachmentDisposition(filename),
        "cache-control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
