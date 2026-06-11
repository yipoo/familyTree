/**
 * 单条媒体：删除 / 改图注
 *
 *   PATCH { caption }   改图注
 *   DELETE              删除（同时删 OSS 对象）
 *
 * 权限：挂人物则 requireWriteOnPerson，否则 requireFamilyWrite。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyWrite, requireWriteOnPerson } from "@/lib/auth/guard";
import { handleApiError, readJson, zodError, notFound } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";
import { deleteObject } from "@/lib/services/oss";

const PatchSchema = z.object({ caption: z.string().max(500).nullable() });

async function loadAndAuth(familyId: string, id: string) {
  const media = await prisma.media.findFirst({ where: { id, familyId } });
  if (!media) return { media: null as null, auth: null };
  const auth = media.personId
    ? await requireWriteOnPerson(familyId, media.personId)
    : await requireFamilyWrite(familyId);
  return { media, auth };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ familyId: string; id: string }> },
) {
  const { familyId, id } = await ctx.params;
  try {
    const { media, auth } = await loadAndAuth(familyId, id);
    if (!media) return notFound("媒体不存在");

    const parsed = PatchSchema.safeParse((await readJson<unknown>(req)) ?? {});
    if (!parsed.success) return zodError(parsed.error);

    const updated = await prisma.media.update({
      where: { id },
      data: { caption: parsed.data.caption },
    });
    await writeAudit({
      familyId,
      actorId: auth!.user.id,
      kind: "UPDATE",
      entity: "Media",
      entityId: id,
      before: { caption: media.caption },
      after: { caption: updated.caption },
    });
    return NextResponse.json({ data: { id, caption: updated.caption } });
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
    const { media, auth } = await loadAndAuth(familyId, id);
    if (!media) return notFound("媒体不存在");

    await prisma.media.delete({ where: { id } });
    if (media.objectKey) await deleteObject(media.objectKey);

    await writeAudit({
      familyId,
      actorId: auth!.user.id,
      kind: "DELETE",
      entity: "Media",
      entityId: id,
      before: { kind: media.kind, name: media.name, personId: media.personId },
    });
    return NextResponse.json({ data: { deleted: true } });
  } catch (e) {
    return handleApiError(e);
  }
}
