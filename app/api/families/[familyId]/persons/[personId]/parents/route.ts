import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ParentRelation } from "@/lib/generated/prisma/enums";
import { authErrorResponse, requireWriteOnPerson } from "@/lib/auth/guard";

interface Body {
  fatherId?: string | null;
  motherId?: string | null;
}

/**
 * 替换某人的父亲 / 母亲：删除现有 BIOLOGICAL 主关系，写入新关系。
 * 传 null 表示清除。未指定的字段保留不动。
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ familyId: string; personId: string }> },
) {
  const { familyId, personId } = await ctx.params;
  try {
    await requireWriteOnPerson(familyId, personId);
  } catch (e) {
    return authErrorResponse(e);
  }
  const body = (await req.json()) as Body;

  const child = await prisma.person.findFirst({
    where: { id: personId, familyId, deletedAt: null },
  });
  if (!child) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "未找到子女" } },
      { status: 404 },
    );
  }

  await prisma.$transaction(async (tx) => {
    // father
    if (body.fatherId !== undefined) {
      const existing = await tx.parentChild.findMany({
        where: { childId: personId, familyId, isPrimary: true },
        include: { parent: true },
      });
      const fatherRel = existing.find((r) => r.parent.gender === "MALE");
      if (fatherRel) {
        await tx.parentChild.delete({ where: { id: fatherRel.id } });
      }
      if (body.fatherId) {
        await tx.parentChild.create({
          data: {
            familyId,
            parentId: body.fatherId,
            childId: personId,
            relation: ParentRelation.BIOLOGICAL,
            isPrimary: true,
            birthOrder: child.birthOrder ?? null,
          },
        });
      }
    }
    // mother
    if (body.motherId !== undefined) {
      const existing = await tx.parentChild.findMany({
        where: { childId: personId, familyId, isPrimary: true },
        include: { parent: true },
      });
      const motherRel = existing.find((r) => r.parent.gender === "FEMALE");
      if (motherRel) {
        await tx.parentChild.delete({ where: { id: motherRel.id } });
      }
      if (body.motherId) {
        await tx.parentChild.create({
          data: {
            familyId,
            parentId: body.motherId,
            childId: personId,
            relation: ParentRelation.BIOLOGICAL,
            isPrimary: true,
            birthOrder: child.birthOrder ?? null,
          },
        });
      }
    }
  });

  return NextResponse.json({ data: { id: personId, updated: true } });
}
