import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Gender, LifeStatus } from "@/lib/generated/prisma/enums";
import {
  authErrorResponse,
  requireFamilyRole,
  requireWriteOnPerson,
} from "@/lib/auth/guard";
import { writeAudit } from "@/lib/services/audit";
import { hashPhone } from "@/lib/services/phone";

interface PatchBody {
  name?: string;
  gender?: "MALE" | "FEMALE" | "UNKNOWN";
  birthOrder?: number | null;
  alias?: string | null;
  status?: "ALIVE" | "DECEASED" | "LOST" | "UNKNOWN";
  generationChar?: string | null;
  birthPlace?: string | null;
  biography?: string | null;
  note?: string | null;
  isMarriedIn?: boolean;
  avatarUrl?: string | null;
  /** 在世族人联系手机号（明文传入，仅存哈希用于小程序自动定位；"" / null 清除） */
  contactPhone?: string | null;
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
  const person = await prisma.person.findFirst({
    where: { id: personId, familyId, deletedAt: null },
  });
  if (!person) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "未找到" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ data: person });
}

export async function PATCH(
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
  const body = (await req.json()) as PatchBody;

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.gender !== undefined) data.gender = body.gender as Gender;
  if (body.birthOrder !== undefined) data.birthOrder = body.birthOrder;
  if (body.alias !== undefined) data.alias = body.alias;
  if (body.status !== undefined) data.status = body.status as LifeStatus;
  if (body.generationChar !== undefined) data.generationChar = body.generationChar;
  if (body.birthPlace !== undefined) data.birthPlace = body.birthPlace;
  if (body.biography !== undefined) data.biography = body.biography;
  if (body.note !== undefined) data.note = body.note;
  if (body.isMarriedIn !== undefined) data.isMarriedIn = body.isMarriedIn;
  if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;
  if (body.contactPhone !== undefined)
    data.contactPhoneHash = body.contactPhone ? hashPhone(body.contactPhone) : null;

  const before = await prisma.person.findFirst({
    where: { id: personId, familyId, deletedAt: null },
  });
  if (!before) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "未找到" } },
      { status: 404 },
    );
  }
  // 排行调整：人物自身的 Person.birthOrder 和 ParentChild.birthOrder（关系侧）
  // 是双写关系——添加亲属时一起填的。tree / 详细图 排序读的是 ParentChild.birthOrder，
  // 所以编辑这里若不同步关系行，画面排序不会变。一起更新保持一致。
  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.person.update({
      where: { id: personId },
      data,
    });
    if (body.birthOrder !== undefined) {
      await tx.parentChild.updateMany({
        where: { familyId, childId: personId },
        data: { birthOrder: body.birthOrder ?? null },
      });
    }
    return updated;
  });
  await writeAudit({
    familyId,
    actorId,
    kind: "UPDATE",
    entity: "Person",
    entityId: personId,
    before,
    after,
  });
  return NextResponse.json({ data: after });
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
  const before = await prisma.person.findFirst({
    where: { id: personId, familyId, deletedAt: null },
  });
  if (!before) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "未找到" } },
      { status: 404 },
    );
  }
  await prisma.person.update({
    where: { id: personId },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    familyId,
    actorId,
    kind: "DELETE",
    entity: "Person",
    entityId: personId,
    before,
  });
  return NextResponse.json({ data: { id: personId, deleted: true } });
}
