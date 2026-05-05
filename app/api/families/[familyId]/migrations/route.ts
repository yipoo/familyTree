/**
 * GET  /api/families/[familyId]/migrations        列表（可按 personId / branchId / scope 过滤）
 * POST /api/families/[familyId]/migrations        新增一条迁徙记录
 *
 * 写权限：
 *   - scope=PERSON：对该 person 有写权限
 *   - scope=BRANCH：要 ADMIN+
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  AuthError,
  canWriteOnPerson,
  requireFamilyRole,
  requireFamilyWrite,
  requireUser,
} from "@/lib/auth/guard";
import { handleApiError, badRequest, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";
import { MigrationScope } from "@/lib/generated/prisma/enums";

const CreateSchema = z
  .object({
    scope: z.enum(["PERSON", "BRANCH"]),
    personId: z.string().min(1).optional(),
    branchId: z.string().min(1).optional(),
    year: z.number().int().min(0).max(3000).nullable().optional(),
    fromLocationId: z.string().min(1).nullable().optional(),
    toLocationId: z.string().min(1).nullable().optional(),
    reason: z.string().trim().max(200).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine(
    (d) => (d.scope === "PERSON" ? !!d.personId : !!d.branchId),
    { message: "scope=PERSON 时需 personId；scope=BRANCH 时需 branchId" },
  );

export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const url = new URL(req.url);
    const personId = url.searchParams.get("personId");
    const branchId = url.searchParams.get("branchId");
    const scope = url.searchParams.get("scope");

    const where: Record<string, unknown> = { familyId };
    if (personId) where.personId = personId;
    if (branchId) where.branchId = branchId;
    if (scope === "PERSON" || scope === "BRANCH") where.scope = scope;

    const list = await prisma.migration.findMany({
      where,
      orderBy: [{ year: "asc" }, { id: "asc" }],
      include: {
        fromLocation: true,
        toLocation: true,
        person: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
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

    if (body.scope === "PERSON") {
      const ok = await canWriteOnPerson(me, familyId, body.personId!);
      if (!ok) throw new AuthError(403, "FORBIDDEN", "无权创建该人物的迁徙记录");
      const exists = await prisma.person.findFirst({
        where: { id: body.personId, familyId, deletedAt: null },
      });
      if (!exists) return badRequest("NOT_FOUND", "人物不存在");
    } else {
      await requireFamilyWrite(familyId);
      const exists = await prisma.branch.findFirst({
        where: { id: body.branchId, familyId },
      });
      if (!exists) return badRequest("NOT_FOUND", "支系不存在");
    }

    // 校验地点归属
    for (const lid of [body.fromLocationId, body.toLocationId]) {
      if (!lid) continue;
      const loc = await prisma.location.findUnique({ where: { id: lid } });
      if (!loc) return badRequest("NOT_FOUND", `地点 ${lid} 不存在`);
    }

    const created = await prisma.migration.create({
      data: {
        familyId,
        scope: body.scope as MigrationScope,
        personId: body.scope === "PERSON" ? body.personId : null,
        branchId: body.scope === "BRANCH" ? body.branchId : null,
        year: body.year ?? null,
        fromLocationId: body.fromLocationId ?? null,
        toLocationId: body.toLocationId ?? null,
        reason: body.reason ?? null,
        note: body.note ?? null,
      },
    });
    await writeAudit({
      familyId,
      actorId: me.id,
      kind: "CREATE",
      entity: "Migration",
      entityId: created.id,
      after: created,
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
