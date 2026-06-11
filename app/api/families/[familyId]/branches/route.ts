/**
 * GET  /api/families/[familyId]/branches    支系列表
 * POST /api/families/[familyId]/branches    新建支系（OWNER / ADMIN）
 *
 * 创建支持两种 root 来源：
 *   - rootPersonId：选已有人物（派生支系）
 *   - newRoot：在事务中新建独立人物作为根（处理"找不到上一世"的离散始祖）
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

const NewRootSchema = z.object({
  name: z.string().trim().min(1, "始祖姓名必填").max(40),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]).default("MALE"),
  generation: z.number().int().min(1, "世代必须 ≥ 1").max(200),
});

const CreateSchema = z
  .object({
    name: z.string().trim().min(1, "支系名必填").max(50),
    rootPersonId: z.string().min(1).optional(),
    newRoot: NewRootSchema.optional(),
    locationId: z.string().min(1).optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => !!v.rootPersonId !== !!v.newRoot, {
    message: "rootPersonId 与 newRoot 二选一",
    path: ["rootPersonId"],
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

    // 同名支系防重（先做，避免新建人物又因冲突回滚）
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

    // 路径 A：用已有人物
    if (body.rootPersonId) {
      const root = await prisma.person.findFirst({
        where: { id: body.rootPersonId, familyId, deletedAt: null },
        select: { id: true },
      });
      if (!root) return badRequest("INVALID_ROOT", "根人物不存在或不属于该家族");

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
    }

    // 路径 B：在事务中新建独立人物作为根（离散始祖）
    const newRoot = body.newRoot!;
    const gn = await prisma.generationName.findUnique({
      where: {
        familyId_generation: { familyId, generation: newRoot.generation },
      },
      select: { character: true },
    });

    const { person, branch } = await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          familyId,
          name: newRoot.name,
          gender: newRoot.gender,
          generation: newRoot.generation,
          generationChar: gn?.character ?? null,
        },
      });
      const branch = await tx.branch.create({
        data: {
          familyId,
          name: body.name,
          rootPersonId: person.id,
          locationId: body.locationId ?? null,
          description: body.description ?? null,
        },
      });
      // 把根人物归属到该支系
      const updated = await tx.person.update({
        where: { id: person.id },
        data: { branchId: branch.id },
      });
      return { person: updated, branch };
    });

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "CREATE",
      entity: "Person",
      entityId: person.id,
      after: person,
    });
    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "CREATE",
      entity: "Branch",
      entityId: branch.id,
      after: branch,
    });

    return NextResponse.json({ data: branch, rootPerson: person }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
