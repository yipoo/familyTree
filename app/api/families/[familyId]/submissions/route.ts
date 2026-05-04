/**
 * 提交（PendingSubmission）
 *
 *   POST   提交一条 person-update 待审记录
 *   GET    管理员/族长读取队列（默认 PENDING）
 *
 * 普通成员（MEMBER）通过 POST 走待审；ADMIN+ 直接走 PATCH /persons/:id 即可。
 * 但即便 ADMIN+ 也允许 POST（用于纪录建议），这里不阻止。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  authErrorResponse,
  requireFamilyRole,
  requireFamilyWrite,
} from "@/lib/auth/guard";
import {
  diffPersonUpdate,
  type SubmissionPayload,
} from "@/lib/services/submissions";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  let user;
  try {
    const c = await requireFamilyRole(familyId, "MEMBER");
    user = c.user;
  } catch (e) {
    return authErrorResponse(e);
  }

  const body = await req.json().catch(() => null);
  const personId = String(body?.personId ?? "");
  if (!personId) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "personId 必填" } },
      { status: 400 },
    );
  }

  const original = await prisma.person.findFirst({
    where: { id: personId, familyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      alias: true,
      birthOrder: true,
      status: true,
      birthYear: true,
      deathYear: true,
      birthPlace: true,
      biography: true,
      note: true,
    },
  });
  if (!original) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "人物不存在" } },
      { status: 404 },
    );
  }

  // 把 body.changes 当 plain object 走 diff
  const fd = new FormData();
  for (const [k, v] of Object.entries(body?.changes ?? {})) {
    if (v === null || v === undefined) {
      fd.set(k, "");
    } else {
      fd.set(k, String(v));
    }
  }
  const changes = diffPersonUpdate(
    original as unknown as Record<string, unknown>,
    fd,
  );
  if (Object.keys(changes).length === 0) {
    return NextResponse.json(
      { error: { code: "NO_CHANGES", message: "没有任何变更" } },
      { status: 400 },
    );
  }

  const payload: SubmissionPayload = {
    kind: "person-update",
    personId,
    personName: original.name,
    changes,
  };

  const submission = await prisma.pendingSubmission.create({
    data: {
      familyId,
      submitterId: user.id,
      payload: payload as unknown as object,
      status: "PENDING",
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ data: submission }, { status: 201 });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyWrite(familyId);
  } catch (e) {
    return authErrorResponse(e);
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "PENDING";

  const list = await prisma.pendingSubmission.findMany({
    where: {
      familyId,
      status: ["PENDING", "APPROVED", "REJECTED"].includes(status)
        ? (status as "PENDING" | "APPROVED" | "REJECTED")
        : "PENDING",
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // 拉取 submitter 名字
  const submitterIds = [...new Set(list.map((s) => s.submitterId))];
  const submitters = await prisma.user.findMany({
    where: { id: { in: submitterIds } },
    select: { id: true, name: true },
  });
  const submitterById = new Map(submitters.map((u) => [u.id, u.name]));

  const enriched = list.map((s) => ({
    ...s,
    submitterName: submitterById.get(s.submitterId) ?? "—",
  }));

  return NextResponse.json({ data: enriched });
}
