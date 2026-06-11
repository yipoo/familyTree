/**
 * GET  /api/families/[familyId]/join-requests   列出该家族的入族申请（OWNER/ADMIN）
 * POST /api/families/[familyId]/join-requests   申请加入（任何已登录用户、家族 isPublic=true）
 *
 * 同一用户对同一家族只持一条记录：
 *   - 已是 FamilyMember → 拒绝（CONFLICT）
 *   - 已有 PENDING → 直接更新 message（不算新申请）
 *   - 已有 REJECTED / CANCELLED → upsert 回 PENDING（重新申请）
 *   - 已 APPROVED → 实际上应该是成员了；按 CONFLICT 处理
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  requireFamilyWrite,
  requireUser,
} from "@/lib/auth/guard";
import {
  badRequest,
  conflict,
  handleApiError,
  notFound,
  readJson,
  zodError,
} from "@/lib/api/error";

const ApplySchema = z.object({
  message: z.string().trim().max(200).optional().nullable(),
});

const ListQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    const user = await requireUser();
    const json = await readJson<unknown>(req);
    const parsed = ApplySchema.safeParse(json ?? {});
    if (!parsed.success) return zodError(parsed.error);
    const message = parsed.data.message?.trim() || null;

    const family = await prisma.family.findFirst({
      where: { id: familyId, deletedAt: null },
      select: { id: true, isPublic: true },
    });
    if (!family) return notFound("家族不存在");
    if (!family.isPublic) {
      return badRequest(
        "NOT_PUBLIC",
        "该家族未公开，需要邀请码加入",
      );
    }

    // 已是成员 → 不允许重复申请
    const member = await prisma.familyMember.findUnique({
      where: { userId_familyId: { userId: user.id, familyId } },
      select: { id: true },
    });
    if (member) return conflict("ALREADY_MEMBER", "你已是该家族成员");

    // upsert：复用 (familyId, userId) 那条
    const existing = await prisma.joinRequest.findUnique({
      where: { familyId_userId: { familyId, userId: user.id } },
      select: { id: true, status: true },
    });

    let row;
    if (existing) {
      if (existing.status === "APPROVED") {
        return conflict("ALREADY_APPROVED", "已通过，应已是成员");
      }
      row = await prisma.joinRequest.update({
        where: { id: existing.id },
        data: {
          status: "PENDING",
          message,
          decidedAt: null,
          decidedById: null,
          decidedNote: null,
        },
      });
    } else {
      row = await prisma.joinRequest.create({
        data: {
          familyId,
          userId: user.id,
          message,
          status: "PENDING",
        },
      });
    }

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyWrite(familyId);
    const url = new URL(req.url);
    const queryRaw = Object.fromEntries(url.searchParams.entries());
    const parsed = ListQuerySchema.safeParse(queryRaw);
    if (!parsed.success) return zodError(parsed.error);

    const requests = await prisma.joinRequest.findMany({
      where: {
        familyId,
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        decidedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: requests });
  } catch (e) {
    return handleApiError(e);
  }
}
