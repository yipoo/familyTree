/**
 * GET  /api/families/[familyId]/members              列出家族成员
 * POST /api/families/[familyId]/members              通过手机号邀请成员（要求对方已注册）
 *
 * 仅 ADMIN+ 可写。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyRole, requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, readJson, zodError, badRequest } from "@/lib/api/error";
import { normalizePhone } from "@/lib/auth/password";
import { writeAudit } from "@/lib/services/audit";
import type { FamilyRole } from "@/lib/generated/prisma/enums";

const ASSIGNABLE: FamilyRole[] = ["ADMIN", "MEMBER", "GUEST"];

const InviteByPhoneSchema = z.object({
  phone: z.string().min(1),
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]).default("MEMBER"),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");

    const members = await prisma.familyMember.findMany({
      where: { familyId },
      orderBy: { joinedAt: "asc" },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, avatarUrl: true } },
      },
    });
    return NextResponse.json({
      data: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        personId: m.personId,
        user: m.user,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    const ctxAuth = await requireFamilyWrite(familyId);
    const json = await readJson<unknown>(req);
    const parsed = InviteByPhoneSchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);
    const role = parsed.data.role as FamilyRole;
    if (!ASSIGNABLE.includes(role)) return badRequest("VALIDATION_FAILED", "角色不合法");

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) return badRequest("VALIDATION_FAILED", "手机号格式不正确");

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return badRequest("USER_NOT_REGISTERED", "该手机号尚未注册");

    const before = await prisma.familyMember.findUnique({
      where: { userId_familyId: { userId: user.id, familyId } },
    });
    const after = await prisma.familyMember.upsert({
      where: { userId_familyId: { userId: user.id, familyId } },
      update: { role },
      create: { userId: user.id, familyId, role },
    });

    await writeAudit({
      familyId,
      actorId: ctxAuth.user.id,
      kind: before ? "UPDATE" : "CREATE",
      entity: "FamilyMember",
      entityId: `${user.id}::${familyId}`,
      before,
      after,
    });

    return NextResponse.json({ data: after }, { status: before ? 200 : 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
