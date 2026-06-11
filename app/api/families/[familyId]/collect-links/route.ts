/**
 * 二维码采集链接（管理端）
 *
 *   POST  创建采集链接（针对某人物，模式 = 校正本人 / 补全子女）
 *   GET   列出本家族采集链接 + 状态 + 使用次数
 *
 * 权限：requireFamilyWrite（族长 / 管理员）。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, readJson, zodError, badRequest } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const Schema = z.object({
  personId: z.string().min(1),
  mode: z.enum(["PERSON_UPDATE", "ADD_CHILD"]).default("PERSON_UPDATE"),
  note: z.string().trim().max(200).optional(),
  maxUses: z.number().int().positive().max(10000).nullable().optional(),
  expiresInDays: z.number().int().positive().max(365).nullable().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await ctx.params;
  try {
    const auth = await requireFamilyWrite(familyId);
    const parsed = Schema.safeParse((await readJson<unknown>(req)) ?? {});
    if (!parsed.success) return zodError(parsed.error);
    const { personId, mode, note, maxUses, expiresInDays } = parsed.data;

    const person = await prisma.person.findFirst({
      where: { id: personId, familyId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!person) return badRequest("BAD_PERSON", "人物不存在");

    const token = globalThis.crypto.randomUUID().replace(/-/g, "");
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000)
      : null;

    const link = await prisma.collectionLink.create({
      data: {
        familyId,
        token,
        personId,
        mode,
        note: note ?? null,
        maxUses: maxUses ?? null,
        expiresAt,
        createdById: auth.user.id,
      },
    });

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "CREATE",
      entity: "CollectionLink",
      entityId: link.id,
      after: { personName: person.name, mode },
    });

    return NextResponse.json(
      { data: { ...link, personName: person.name } },
      { status: 201 },
    );
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyWrite(familyId);
    const links = await prisma.collectionLink.findMany({
      where: { familyId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { person: { select: { name: true, generation: true } } },
    });
    const now = Date.now();
    const data = links.map((l) => ({
      id: l.id,
      token: l.token,
      personId: l.personId,
      personName: l.person.name,
      mode: l.mode,
      note: l.note,
      uses: l.uses,
      maxUses: l.maxUses,
      expiresAt: l.expiresAt,
      revokedAt: l.revokedAt,
      createdAt: l.createdAt,
      status: l.revokedAt
        ? "revoked"
        : l.expiresAt && l.expiresAt.getTime() < now
          ? "expired"
          : l.maxUses != null && l.uses >= l.maxUses
            ? "exhausted"
            : "active",
    }));
    return NextResponse.json({ data });
  } catch (e) {
    return handleApiError(e);
  }
}
