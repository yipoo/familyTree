/**
 * 单条提交：审核（approve / reject）。
 *
 *   POST { action: "approve" }       应用 payload，状态 → APPROVED
 *   POST { action: "reject", note }  状态 → REJECTED
 *
 *   DELETE                           提交者本人撤回（PENDING 状态）
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  authErrorResponse,
  requireFamilyRole,
  requireFamilyWrite,
} from "@/lib/auth/guard";
import { applyPayload, parsePayload } from "@/lib/services/submissions";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ familyId: string; id: string }> },
) {
  const { familyId, id } = await ctx.params;
  let reviewer;
  try {
    const c = await requireFamilyWrite(familyId);
    reviewer = c.user;
  } catch (e) {
    return authErrorResponse(e);
  }

  const sub = await prisma.pendingSubmission.findUnique({ where: { id } });
  if (!sub || sub.familyId !== familyId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "提交不存在" } },
      { status: 404 },
    );
  }
  if (sub.status !== "PENDING") {
    return NextResponse.json(
      { error: { code: "ALREADY_REVIEWED", message: "该提交已审核过" } },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? "");
  const note = body?.note ? String(body.note).slice(0, 500) : null;

  if (action === "approve") {
    const payload = parsePayload(sub.payload);
    if (!payload) {
      return NextResponse.json(
        { error: { code: "BAD_PAYLOAD", message: "提交内容损坏" } },
        { status: 400 },
      );
    }
    const result = await applyPayload(payload, familyId);
    if (result.applied === 0) {
      // 目标可能已删，标记为 REJECTED
      await prisma.pendingSubmission.update({
        where: { id },
        data: {
          status: "REJECTED",
          reviewerId: reviewer.id,
          reviewNote: "目标人物已不存在",
          reviewedAt: new Date(),
        },
      });
      return NextResponse.json(
        { error: { code: "STALE", message: "目标人物已不存在，提交已自动拒绝" } },
        { status: 410 },
      );
    }
    await prisma.$transaction([
      prisma.pendingSubmission.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewerId: reviewer.id,
          reviewNote: note,
          reviewedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          familyId,
          actorId: reviewer.id,
          kind: "APPROVE",
          entity: "PendingSubmission",
          entityId: id,
          after: sub.payload as object,
        },
      }),
    ]);
    return NextResponse.json({ data: { ok: true } });
  }

  if (action === "reject") {
    await prisma.$transaction([
      prisma.pendingSubmission.update({
        where: { id },
        data: {
          status: "REJECTED",
          reviewerId: reviewer.id,
          reviewNote: note,
          reviewedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          familyId,
          actorId: reviewer.id,
          kind: "REJECT",
          entity: "PendingSubmission",
          entityId: id,
          after: { reviewNote: note } as object,
        },
      }),
    ]);
    return NextResponse.json({ data: { ok: true } });
  }

  return NextResponse.json(
    { error: { code: "VALIDATION_FAILED", message: "action 必须为 approve / reject" } },
    { status: 400 },
  );
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; id: string }> },
) {
  const { familyId, id } = await ctx.params;
  let user;
  try {
    const c = await requireFamilyRole(familyId, "MEMBER");
    user = c.user;
  } catch (e) {
    return authErrorResponse(e);
  }
  const sub = await prisma.pendingSubmission.findUnique({ where: { id } });
  if (!sub || sub.familyId !== familyId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "提交不存在" } },
      { status: 404 },
    );
  }
  if (sub.submitterId !== user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "只能撤回自己的提交" } },
      { status: 403 },
    );
  }
  if (sub.status !== "PENDING") {
    return NextResponse.json(
      { error: { code: "ALREADY_REVIEWED", message: "已审核的提交不可撤回" } },
      { status: 409 },
    );
  }
  await prisma.pendingSubmission.delete({ where: { id } });
  return NextResponse.json({ data: { withdrawn: true } });
}
