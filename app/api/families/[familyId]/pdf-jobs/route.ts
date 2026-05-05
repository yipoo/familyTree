/**
 * GET  /api/families/[familyId]/pdf-jobs        列出最近 PDF 任务（不返回 bytes）
 * POST /api/families/[familyId]/pdf-jobs        新建任务
 *
 * 这条入口允许统一创建（type=LINEAGE_CHART | ALBUM）。
 * 老的 /lineage-chart/pdf 与 /album/pdf 也保留兼容（小家族同步生成、大家族跳异步）。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyRole } from "@/lib/auth/guard";
import { handleApiError, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";
import { bootstrapQueue, createJob } from "@/lib/services/pdf-queue";
import { withRateLimit } from "@/lib/rate-limit-middleware";

const CreateSchema = z.object({
  type: z.enum(["LINEAGE_CHART", "ALBUM"]),
  params: z.record(z.string(), z.unknown()).optional(),
});

async function listHandler(
  _req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    const auth = await requireFamilyRole(familyId, "MEMBER");
    await bootstrapQueue();

    // 仅列出本人发起 / 或管理员视角全部
    const where =
      auth.role === "OWNER" || auth.role === "ADMIN" || auth.user.platformRole === "SUPERADMIN"
        ? { familyId }
        : { familyId, requestedById: auth.user.id };

    const jobs = await prisma.pdfJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 30,
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

    return NextResponse.json({ data: jobs });
  } catch (e) {
    return handleApiError(e);
  }
}

async function createHandler(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    const auth = await requireFamilyRole(familyId, "MEMBER");
    await bootstrapQueue();

    const json = await readJson<unknown>(req);
    const parsed = CreateSchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);
    const body = parsed.data;

    const job = await createJob({
      familyId,
      type: body.type,
      requestedById: auth.user.id,
      params: body.params ?? {},
    });

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "CREATE",
      entity: "PdfJob",
      entityId: job.id,
      after: { type: job.type, params: body.params ?? {} },
    });

    return NextResponse.json({ data: { id: job.id, status: job.status } }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

export const GET = listHandler;

export const POST = withRateLimit(createHandler, {
  bucket: "pdf-job-create",
  limit: 5,
  windowMs: 60_000,
  withUser: true,
});
