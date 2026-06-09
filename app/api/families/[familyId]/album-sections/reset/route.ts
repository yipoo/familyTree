/**
 * 册谱前置章节：初始化 / 恢复默认
 *
 *   POST            DB 为空时把默认章节列表落库（"初始化章节"）；已初始化则原样返回
 *   POST { force }  清空后重新落库默认列表（"恢复默认"，会丢弃用户编辑）
 *
 * 配合运行时 fallback：默认章节平时是虚拟的（id=null，不可排序/编辑），
 * 落库成真实行后才能在后台增删改排。
 *
 * 权限：requireFamilyWrite。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";
import { defaultSectionCreateData } from "@/lib/services/album-sections";

const ResetSchema = z.object({ force: z.boolean().optional() });

export async function POST(req: Request, ctx: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await ctx.params;
  try {
    const auth = await requireFamilyWrite(familyId);
    const parsed = ResetSchema.safeParse((await readJson<unknown>(req)) ?? {});
    if (!parsed.success) return zodError(parsed.error);
    const force = parsed.data.force === true;

    const count = await prisma.albumSection.count({ where: { familyId } });
    if (count > 0 && !force) {
      const rows = await prisma.albumSection.findMany({
        where: { familyId },
        orderBy: { order: "asc" },
      });
      return NextResponse.json({ data: rows, seeded: false });
    }

    await prisma.$transaction(async (tx) => {
      if (force) await tx.albumSection.deleteMany({ where: { familyId } });
      await tx.albumSection.createMany({ data: defaultSectionCreateData(familyId) });
    });

    const rows = await prisma.albumSection.findMany({
      where: { familyId },
      orderBy: { order: "asc" },
    });

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: force ? "UPDATE" : "CREATE",
      entity: "AlbumSection",
      entityId: familyId,
      after: { seeded: rows.length, force },
    });

    return NextResponse.json({ data: rows, seeded: true }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
