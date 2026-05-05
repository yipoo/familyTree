/**
 * GET   /api/families/[familyId]/invites    列出邀请码
 * POST  /api/families/[familyId]/invites    生成新邀请码
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";
import { generateInviteCode } from "@/lib/services/invites";
import type { FamilyRole } from "@/lib/generated/prisma/enums";

const TTL_MAP: Record<string, number | null> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "180d": 180,
  never: null,
};

const ASSIGNABLE: FamilyRole[] = ["ADMIN", "MEMBER", "GUEST"];

const CreateSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]).default("MEMBER"),
  ttl: z.enum(["1d", "7d", "30d", "180d", "never"]).default("30d"),
  /** "1" / "10" / "many"（不限） */
  uses: z.enum(["1", "10", "many"]).default("many"),
  note: z.string().trim().max(200).optional().nullable(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyWrite(familyId);
    const list = await prisma.familyInvite.findMany({
      where: { familyId },
      orderBy: { createdAt: "desc" },
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
    const auth = await requireFamilyWrite(familyId);
    const json = await readJson<unknown>(req);
    const parsed = CreateSchema.safeParse(json ?? {});
    if (!parsed.success) return zodError(parsed.error);
    const role = parsed.data.role as FamilyRole;
    if (!ASSIGNABLE.includes(role)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "角色不合法" } },
        { status: 400 },
      );
    }

    const days = TTL_MAP[parsed.data.ttl];
    const expiresAt = days === null ? null : new Date(Date.now() + days * 86400000);
    const maxUses = parsed.data.uses === "1" ? 1 : parsed.data.uses === "10" ? 10 : null;

    let attempt = 0;
    let created = null as Awaited<ReturnType<typeof prisma.familyInvite.create>> | null;
    while (attempt < 5 && !created) {
      try {
        created = await prisma.familyInvite.create({
          data: {
            familyId,
            code: generateInviteCode(),
            role,
            maxUses,
            expiresAt,
            note: parsed.data.note ?? null,
            createdById: auth.user.id,
          },
        });
      } catch (e) {
        if (
          e instanceof Error &&
          /Unique constraint/.test(e.message) &&
          attempt < 4
        ) {
          attempt++;
          continue;
        }
        throw e;
      }
    }
    if (!created) {
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "生成邀请码失败" } },
        { status: 500 },
      );
    }

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "CREATE",
      entity: "FamilyInvite",
      entityId: created.id,
      after: { code: created.code, role: created.role, expiresAt: created.expiresAt },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
