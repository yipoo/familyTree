/**
 * GET  /api/families/[familyId]/marriages              列出（可按 personId 过滤）
 * POST /api/families/[familyId]/marriages              新建婚配
 *
 * 写权限：对 husbandId 或 wifeId 任一拥有 person 写权限即可（按男方为准上溯）
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  AuthError,
  canWriteOnPerson,
  requireFamilyRole,
  requireUser,
} from "@/lib/auth/guard";
import { handleApiError, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const CreateSchema = z.object({
  husbandId: z.string().min(1),
  wifeId: z.string().min(1),
  type: z.enum(["PRIMARY", "SECONDARY", "CONCUBINE", "UXORILOCAL"]).default("PRIMARY"),
  order: z.number().int().min(1).max(100).optional(),
  marriedYear: z.number().int().min(0).max(3000).optional().nullable(),
  endedYear: z.number().int().min(0).max(3000).optional().nullable(),
  endedReason: z.string().trim().max(200).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const url = new URL(req.url);
    const personId = url.searchParams.get("personId");
    const where = personId
      ? { familyId, OR: [{ husbandId: personId }, { wifeId: personId }] }
      : { familyId };

    const list = await prisma.marriage.findMany({
      where,
      orderBy: [{ husbandId: "asc" }, { order: "asc" }],
      include: {
        husband: { select: { id: true, name: true, gender: true } },
        wife: { select: { id: true, name: true, gender: true } },
      },
    });
    return NextResponse.json({ data: list });
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
    const me = await requireUser();
    const json = await readJson<unknown>(req);
    const parsed = CreateSchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);
    const body = parsed.data;

    const [husband, wife] = await Promise.all([
      prisma.person.findFirst({
        where: { id: body.husbandId, familyId, deletedAt: null },
      }),
      prisma.person.findFirst({
        where: { id: body.wifeId, familyId, deletedAt: null },
      }),
    ]);
    if (!husband || !wife) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "夫或妻不存在或不属于该家族" } },
        { status: 404 },
      );
    }

    // 写权限：只要对一方有写权限即可
    const can =
      (await canWriteOnPerson(me, familyId, body.husbandId)) ||
      (await canWriteOnPerson(me, familyId, body.wifeId));
    if (!can) throw new AuthError(403, "FORBIDDEN", "无权创建该婚配");

    // order 自动分配（同一 husband 下顺序）
    const order = body.order
      ? body.order
      : ((await prisma.marriage.count({
          where: { familyId, husbandId: body.husbandId },
        })) +
        1);

    const created = await prisma.marriage.create({
      data: {
        familyId,
        husbandId: body.husbandId,
        wifeId: body.wifeId,
        type: body.type,
        order,
        marriedYear: body.marriedYear ?? null,
        endedYear: body.endedYear ?? null,
        endedReason: body.endedReason ?? null,
        note: body.note ?? null,
      },
    });

    await writeAudit({
      familyId,
      actorId: me.id,
      kind: "CREATE",
      entity: "Marriage",
      entityId: created.id,
      after: created,
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
