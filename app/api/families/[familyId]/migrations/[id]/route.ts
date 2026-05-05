/**
 * GET    /api/families/[familyId]/migrations/[id]
 * PATCH  /api/families/[familyId]/migrations/[id]
 * DELETE /api/families/[familyId]/migrations/[id]
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
import { handleApiError, badRequest, notFound, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const PatchSchema = z.object({
  year: z.number().int().min(0).max(3000).nullable().optional(),
  fromLocationId: z.string().min(1).nullable().optional(),
  toLocationId: z.string().min(1).nullable().optional(),
  reason: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

async function loadOrThrow(familyId: string, id: string) {
  const m = await prisma.migration.findUnique({ where: { id } });
  if (!m || m.familyId !== familyId) return null;
  return m;
}

async function ensureWriteRights(
  me: Awaited<ReturnType<typeof requireUser>>,
  familyId: string,
  m: { scope: string; personId: string | null },
) {
  if (m.scope === "PERSON" && m.personId) {
    const ok = await canWriteOnPerson(me, familyId, m.personId);
    if (!ok) throw new AuthError(403, "FORBIDDEN", "无权操作");
  } else {
    await requireFamilyWrite(familyId);
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; id: string }> },
) {
  const { familyId, id } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const m = await prisma.migration.findUnique({
      where: { id },
      include: {
        fromLocation: true,
        toLocation: true,
        person: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    if (!m || m.familyId !== familyId) return notFound("迁徙记录不存在");
    return NextResponse.json({ data: m });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ familyId: string; id: string }> },
) {
  const { familyId, id } = await ctx.params;
  try {
    const me = await requireUser();
    const before = await loadOrThrow(familyId, id);
    if (!before) return notFound("迁徙记录不存在");
    await ensureWriteRights(me, familyId, before);

    const json = await readJson<unknown>(req);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);

    for (const lid of [parsed.data.fromLocationId, parsed.data.toLocationId]) {
      if (!lid) continue;
      const loc = await prisma.location.findUnique({ where: { id: lid } });
      if (!loc) return badRequest("NOT_FOUND", `地点 ${lid} 不存在`);
    }

    const data: Record<string, unknown> = {};
    for (const k of [
      "year",
      "fromLocationId",
      "toLocationId",
      "reason",
      "note",
    ] as const) {
      if (parsed.data[k] !== undefined) data[k] = parsed.data[k];
    }
    const updated = await prisma.migration.update({ where: { id }, data });

    await writeAudit({
      familyId,
      actorId: me.id,
      kind: "UPDATE",
      entity: "Migration",
      entityId: id,
      before,
      after: updated,
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; id: string }> },
) {
  const { familyId, id } = await ctx.params;
  try {
    const me = await requireUser();
    const before = await loadOrThrow(familyId, id);
    if (!before) return notFound("迁徙记录不存在");
    await ensureWriteRights(me, familyId, before);

    await prisma.migration.delete({ where: { id } });
    await writeAudit({
      familyId,
      actorId: me.id,
      kind: "DELETE",
      entity: "Migration",
      entityId: id,
      before,
    });
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (e) {
    return handleApiError(e);
  }
}
