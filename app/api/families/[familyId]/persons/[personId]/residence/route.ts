/**
 * 单人居住地：读取（含继承解析）+ 设置 + 清除（恢复继承）。
 *
 *   GET    → { explicit, effective, source }
 *           explicit:  自己显式设置的；null = 没设
 *           effective: 计算后的（自己有用自己；否则沿父系/夫上溯）
 *           source.fromPersonId: 继承命中的人物（== personId 即自己）
 *
 *   PUT    body { province?, city?, county?, town?, village?, detail? }
 *          按 fullText 唯一去 upsert Location，再写到 Person.residenceId
 *
 *   DELETE 把 residenceId 置 null（让该人沿父系/夫继承）
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  authErrorResponse,
  requireFamilyRole,
  requireWriteOnPerson,
} from "@/lib/auth/guard";
import { resolveResidence } from "@/lib/services/residence";
import { writeAudit } from "@/lib/services/audit";

const partSchema = z.object({
  province: z.string().trim().max(20).optional().nullable(),
  city: z.string().trim().max(20).optional().nullable(),
  county: z.string().trim().max(20).optional().nullable(),
  town: z.string().trim().max(20).optional().nullable(),
  village: z.string().trim().max(40).optional().nullable(),
  detail: z.string().trim().max(80).optional().nullable(),
});

function buildFullText(p: z.infer<typeof partSchema>): string {
  return [p.province, p.city, p.county, p.town, p.village, p.detail]
    .filter((s) => s && s.trim().length > 0)
    .join(" ");
}

async function loadLocation(id: string | null) {
  if (!id) return null;
  return prisma.location.findUnique({ where: { id } });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; personId: string }> },
) {
  const { familyId, personId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
  } catch (e) {
    return authErrorResponse(e);
  }

  const me = await prisma.person.findFirst({
    where: { id: personId, familyId, deletedAt: null },
    select: { id: true, residenceId: true },
  });
  if (!me) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "未找到" } },
      { status: 404 },
    );
  }

  const explicit = await loadLocation(me.residenceId);
  const effectiveId = me.residenceId ?? (await resolveResidence(personId));
  const effective =
    effectiveId === me.residenceId ? explicit : await loadLocation(effectiveId);

  // 找出继承命中的人物
  let fromPersonId: string | null = me.residenceId ? personId : null;
  if (!fromPersonId && effectiveId) {
    // 重新走一遍上溯，找哪一个 person 真有 residenceId === effectiveId
    let cur: string | null = personId;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const p: {
        residenceId: string | null;
        isMarriedIn: boolean;
        marriagesAsWife: { husbandId: string }[];
      } | null = await prisma.person.findUnique({
        where: { id: cur },
        select: {
          residenceId: true,
          isMarriedIn: true,
          marriagesAsWife: { take: 1, orderBy: { order: "asc" }, select: { husbandId: true } },
        },
      });
      if (!p) break;
      if (p.residenceId === effectiveId) {
        fromPersonId = cur;
        break;
      }
      cur = p.isMarriedIn
        ? p.marriagesAsWife[0]?.husbandId ?? null
        : (
            await prisma.parentChild.findFirst({
              where: { childId: cur, isPrimary: true, parent: { gender: "MALE" } },
              select: { parentId: true },
            })
          )?.parentId ?? null;
    }
  }

  const fromPerson = fromPersonId
    ? await prisma.person.findUnique({
        where: { id: fromPersonId },
        select: { id: true, name: true, generation: true },
      })
    : null;

  return NextResponse.json({
    data: {
      explicit,
      effective,
      source: {
        fromPersonId,
        fromPerson,
        inherited: !!fromPersonId && fromPersonId !== personId,
      },
    },
  });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ familyId: string; personId: string }> },
) {
  const { familyId, personId } = await ctx.params;
  let actorId: string;
  try {
    const c = await requireWriteOnPerson(familyId, personId);
    actorId = c.user.id;
  } catch (e) {
    return authErrorResponse(e);
  }

  const raw = await req.json().catch(() => null);
  const parsed = partSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "参数不合法" } },
      { status: 400 },
    );
  }

  const fullText = buildFullText(parsed.data);
  if (!fullText) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "至少填写一项地点" } },
      { status: 400 },
    );
  }

  // 先查相同 fullText 的 Location（轻量去重）；找不到则创建
  const existing = await prisma.location.findFirst({ where: { fullText } });
  const loc =
    existing ??
    (await prisma.location.create({
      data: {
        province: parsed.data.province ?? null,
        city: parsed.data.city ?? null,
        county: parsed.data.county ?? null,
        town: parsed.data.town ?? null,
        village: parsed.data.village ?? null,
        detail: parsed.data.detail ?? null,
        fullText,
      },
    }));

  await prisma.person.update({
    where: { id: personId },
    data: { residenceId: loc.id },
  });
  await writeAudit({
    familyId,
    actorId,
    kind: "UPDATE",
    entity: "Person",
    entityId: personId,
    after: { residenceId: loc.id, residenceFullText: loc.fullText },
  });

  return NextResponse.json({ data: { residence: loc } });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; personId: string }> },
) {
  const { familyId, personId } = await ctx.params;
  let actorId: string;
  try {
    const c = await requireWriteOnPerson(familyId, personId);
    actorId = c.user.id;
  } catch (e) {
    return authErrorResponse(e);
  }

  await prisma.person.update({
    where: { id: personId },
    data: { residenceId: null },
  });
  await writeAudit({
    familyId,
    actorId,
    kind: "UPDATE",
    entity: "Person",
    entityId: personId,
    after: { residenceId: null },
  });
  return NextResponse.json({ data: { cleared: true } });
}
