/**
 * 册谱前置章节：批量排序
 *
 *   POST { order: [{ id, order }] }   一次性写入新的 order
 *
 * 权限：requireFamilyWrite。校验所有 id 属于本族，再 $transaction 批量更新。
 * audit entityId 用 familyId（整体重排，kind=UPDATE）。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, readJson, zodError, badRequest } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const ReorderSchema = z.object({
  order: z
    .array(
      z.object({
        id: z.string().min(1),
        order: z.number().int().min(0).max(10000),
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(req: Request, ctx: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await ctx.params;
  try {
    const auth = await requireFamilyWrite(familyId);
    const parsed = ReorderSchema.safeParse((await readJson<unknown>(req)) ?? {});
    if (!parsed.success) return zodError(parsed.error);
    const { order } = parsed.data;

    // 校验所有 id 都属于本族（防越权改他族章节）
    const ids = order.map((o) => o.id);
    const owned = await prisma.albumSection.findMany({
      where: { id: { in: ids }, familyId },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      return badRequest("BAD_SECTION_IDS", "存在不属于本族的章节 id");
    }

    await prisma.$transaction(
      order.map((o) =>
        prisma.albumSection.update({
          where: { id: o.id },
          data: { order: o.order },
        }),
      ),
    );

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "UPDATE",
      entity: "AlbumSection",
      entityId: familyId,
      after: { reordered: ids.length },
    });

    return NextResponse.json({ data: { reordered: ids.length } });
  } catch (e) {
    return handleApiError(e);
  }
}
