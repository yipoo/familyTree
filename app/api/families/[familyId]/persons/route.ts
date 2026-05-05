import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Gender, LifeStatus } from "@/lib/generated/prisma/enums";
import { authErrorResponse, requireFamilyRole } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/services/audit";

interface CreateBody {
  name: string;
  gender?: "MALE" | "FEMALE" | "UNKNOWN";
  generation: number;
  birthOrder?: number | null;
  alias?: string | null;
  status?: "ALIVE" | "DECEASED" | "LOST" | "UNKNOWN";
  isMarriedIn?: boolean;
  generationChar?: string | null;
  birthPlace?: string | null;
  biography?: string | null;
  note?: string | null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  let actorId: string;
  try {
    const c = await requireFamilyRole(familyId, "ADMIN");
    actorId = c.user.id;
  } catch (e) {
    return authErrorResponse(e);
  }
  const body = (await req.json()) as CreateBody;

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "name 必填" } },
      { status: 400 },
    );
  }
  if (typeof body.generation !== "number" || body.generation < 1) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "generation 必须 ≥ 1" } },
      { status: 400 },
    );
  }

  // 取该世字辈
  const gn = await prisma.generationName.findUnique({
    where: { familyId_generation: { familyId, generation: body.generation } },
  });

  const person = await prisma.person.create({
    data: {
      familyId,
      name: body.name.trim(),
      gender: (body.gender ?? "UNKNOWN") as Gender,
      generation: body.generation,
      generationChar: body.generationChar ?? gn?.character ?? null,
      birthOrder: body.birthOrder ?? null,
      alias: body.alias ?? null,
      status: (body.status ?? "ALIVE") as LifeStatus,
      isMarriedIn: !!body.isMarriedIn,
      birthPlace: body.birthPlace ?? null,
      biography: body.biography ?? null,
      note: body.note ?? null,
    },
  });
  await writeAudit({
    familyId,
    actorId,
    kind: "CREATE",
    entity: "Person",
    entityId: person.id,
    after: person,
  });
  return NextResponse.json({ data: person }, { status: 201 });
}
