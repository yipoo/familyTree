/**
 * GET  /api/families/[familyId]/branches    支系列表
 * POST /api/families/[familyId]/branches    新建支系（OWNER / ADMIN）
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyRole, requireFamilyWrite } from "@/lib/auth/guard";
import {
  badRequest,
  conflict,
  handleApiError,
  readJson,
  zodError,
} from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const CreateSchema = z.object({
  name: z.string().trim().min(1, "支系名必填").max(50),
  rootPersonId: z.string().min(1, "根人物必填"),
  locationId: z.string().min(1).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const branches = await prisma.branch.findMany({
      where: { familyId },
      orderBy: { name: "asc" },
      include: {
        rootPerson: { select: { id: true, name: true, generation: true } },
        location: {
          select: { id: true, fullText: true, village: true, town: true, county: true },
        },
        _count: { select: { persons: true, migrations: true } },
      },
    });
    return NextResponse.json({ data: branches });
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
    const auth = await requireFamilyWrite(familyId);
    const json = await readJson<unknown>(req);
    const parsed = CreateSchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);
    const body = parsed.data;

    // 校验 rootPerson 在该家族
    const root = await prisma.person.findFirst({
      where: { id: body.rootPersonId, familyId, deletedAt: null },
      select: { id: true },
    });
    if (!root) return badRequest("INVALID_ROOT", "根人物不存在或不属于该家族");

    // 同名支系防重
    const dup = await prisma.branch.findFirst({
      where: { familyId, name: body.name },
      select: { id: true },
    });
    if (dup) return conflict("DUPLICATE_NAME", "已存在同名支系");

    // locationId 校验（如果给了）
    if (body.locationId) {
      const loc = await prisma.location.findUnique({
        where: { id: body.locationId },
        select: { id: true },
      });
      if (!loc) return badRequest("INVALID_LOCATION", "地点不存在");
    }

    const created = await prisma.branch.create({
      data: {
        familyId,
        name: body.name,
        rootPersonId: body.rootPersonId,
        locationId: body.locationId ?? null,
        description: body.description ?? null,
      },
    });

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "CREATE",
      entity: "Branch",
      entityId: created.id,
      after: created,
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
