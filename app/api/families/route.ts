/**
 * GET  /api/families          列出当前用户加入或拥有的家族（SUPERADMIN 列全部）
 * POST /api/families          创建新家族（任何已登录用户均可，创建者自动成为 OWNER）
 *
 * 创建时可选地预置字辈表（generations）和首支系（firstBranch）以一条龙启动。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { badRequest, handleApiError, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";
import { Gender, FamilyRole } from "@/lib/generated/prisma/enums";

const CreateFamilySchema = z.object({
  surname: z.string().trim().min(1, "姓氏必填").max(20),
  name: z.string().trim().min(1, "家族名必填").max(80),
  description: z.string().trim().max(500).optional().nullable(),
  founderName: z.string().trim().max(40).optional().nullable(),
  /** 可选：预置始祖人物（生成第 1 世） */
  founderPerson: z
    .object({
      name: z.string().trim().min(1).max(40),
      gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]).default("MALE"),
      generationChar: z.string().trim().max(8).optional().nullable(),
    })
    .optional(),
  /** 可选：预置字辈表 */
  generations: z
    .array(
      z.object({
        generation: z.number().int().min(1).max(200),
        character: z.string().trim().min(1).max(8),
      }),
    )
    .max(200)
    .optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const families =
      user.platformRole === "SUPERADMIN"
        ? await prisma.family.findMany({
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            include: {
              _count: { select: { persons: true, members: true, branches: true } },
            },
          })
        : (
            await prisma.familyMember.findMany({
              where: { userId: user.id },
              orderBy: { joinedAt: "asc" },
              include: {
                family: {
                  include: {
                    _count: {
                      select: { persons: true, members: true, branches: true },
                    },
                  },
                },
              },
            })
          )
            .filter((m) => m.family.deletedAt === null)
            .map((m) => ({ ...m.family, myRole: m.role }));

    return NextResponse.json({ data: families });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const json = await readJson<unknown>(req);
    if (!json) return badRequest("INVALID_BODY", "请求 body 必须是 JSON");

    const parsed = CreateFamilySchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);
    const body = parsed.data;

    const family = await prisma.$transaction(async (tx) => {
      const created = await tx.family.create({
        data: {
          surname: body.surname,
          name: body.name,
          description: body.description ?? null,
          founderName: body.founderName ?? null,
          ownerId: user.id,
        },
      });

      await tx.familyMember.create({
        data: {
          userId: user.id,
          familyId: created.id,
          role: FamilyRole.OWNER,
        },
      });

      if (body.generations && body.generations.length > 0) {
        // 去重：同 generation 取最后一条
        const seen = new Map<number, string>();
        for (const g of body.generations) seen.set(g.generation, g.character);
        await tx.generationName.createMany({
          data: Array.from(seen.entries()).map(([generation, character]) => ({
            familyId: created.id,
            generation,
            character,
          })),
        });
      }

      if (body.founderPerson) {
        const gn =
          body.founderPerson.generationChar ??
          (body.generations?.find((g) => g.generation === 1)?.character ?? null);
        await tx.person.create({
          data: {
            familyId: created.id,
            name: body.founderPerson.name,
            gender: body.founderPerson.gender as Gender,
            generation: 1,
            generationChar: gn,
          },
        });
      }

      return created;
    });

    await writeAudit({
      familyId: family.id,
      actorId: user.id,
      kind: "CREATE",
      entity: "Family",
      entityId: family.id,
      after: family,
    });

    return NextResponse.json({ data: family }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

