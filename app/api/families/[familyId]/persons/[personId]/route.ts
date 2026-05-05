import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Gender, LifeStatus } from "@/lib/generated/prisma/enums";
import {
  authErrorResponse,
  requireFamilyRole,
  requireWriteOnPerson,
} from "@/lib/auth/guard";
import { writeAudit } from "@/lib/services/audit";

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

  const before = await prisma.person.findFirst({
    where: { id: personId, familyId, deletedAt: null },
  });
  if (!before) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "未找到" } },
      { status: 404 },
    );
  }
  const after = await prisma.person.update({
    where: { id: personId },
    data,
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
