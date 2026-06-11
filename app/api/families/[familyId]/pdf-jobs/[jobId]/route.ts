/**
 * GET    /api/families/[familyId]/pdf-jobs/[jobId]   查任务状态
 * DELETE /api/families/[familyId]/pdf-jobs/[jobId]   取消（仅 PENDING / RUNNING）
 *
 * 仅家族成员可读、且必须是任务发起人 / OWNER / ADMIN / SUPERADMIN。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireFamilyRole } from "@/lib/auth/guard";
import { handleApiError, notFound } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

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
        type: true,
        status: true,
        progress: true,
        error: true,
        outputName: true,
        requestedById: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
      },
    });
    if (!job) return notFound("任务不存在");

    const isAdmin =
      auth.role === "OWNER" ||
      auth.role === "ADMIN" ||
      auth.user.platformRole === "SUPERADMIN";
    if (!isAdmin && job.requestedById !== auth.user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "无权查看此任务" } },
        { status: 403 },
      );
    }

    return NextResponse.json({ data: job });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; jobId: string }> },
) {
  const { familyId, jobId } = await ctx.params;
  try {
    const auth = await requireFamilyRole(familyId, "MEMBER");
    const job = await prisma.pdfJob.findFirst({
      where: { id: jobId, familyId },
      select: { id: true, status: true, requestedById: true },
    });
    if (!job) return notFound("任务不存在");

    const isAdmin =
      auth.role === "OWNER" ||
      auth.role === "ADMIN" ||
      auth.user.platformRole === "SUPERADMIN";
    if (!isAdmin && job.requestedById !== auth.user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "无权取消此任务" } },
        { status: 403 },
      );
    }

    if (job.status === "DONE" || job.status === "FAILED" || job.status === "CANCELED") {
      return NextResponse.json(
        { error: { code: "ALREADY_FINISHED", message: "任务已结束，无法取消" } },
        { status: 409 },
      );
    }

    await prisma.pdfJob.update({
      where: { id: job.id },
      data: { status: "CANCELED", finishedAt: new Date() },
    });
    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "DELETE",
      entity: "PdfJob",
      entityId: job.id,
      before: { status: job.status },
      after: { status: "CANCELED" },
    });

    return NextResponse.json({ data: { id: job.id, status: "CANCELED" } });
  } catch (e) {
    return handleApiError(e);
  }
}
