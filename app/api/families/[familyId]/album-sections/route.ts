/**
 * 册谱前置章节（管理端）
 *
 *   GET   列出本家族章节（无记录则返回默认列表 + initialized=false）
 *   POST  新增一个可插入章节（自定义文字/图片 / 多篇谱序）
 *
 * 权限：GET 成员可读；POST 族级写（族长 / 管理员）。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyRole, requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, readJson, zodError, conflict } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";
import { ossSignIfOurs } from "@/lib/services/oss";
import {
  resolveAlbumSections,
  defaultSectionCreateData,
} from "@/lib/services/album-sections";

export async function GET(_req: Request, ctx: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const rows = await prisma.albumSection.findMany({
      where: { familyId },
      orderBy: { order: "asc" },
    });
    const sections = resolveAlbumSections(rows).map((s) => ({
      ...s,
      imageUrl: s.imageUrl ? ossSignIfOurs(s.imageUrl) : null,
    }));
    return NextResponse.json({ data: sections, initialized: rows.length > 0 });
  } catch (e) {
    return handleApiError(e);
  }
}

const CreateSchema = z
  .object({
    kind: z.enum(["CUSTOM_TEXT", "CUSTOM_IMAGE", "PREFACE", "COVER"]),
    title: z.string().trim().max(80).nullable().optional(),
    subtitle: z.string().trim().max(120).nullable().optional(),
    body: z.string().max(50000).nullable().optional(),
    signature: z.string().trim().max(200).nullable().optional(),
    imageUrl: z.string().trim().max(4000).nullable().optional(),
    appliesTo: z.array(z.string().max(20)).max(8).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "CUSTOM_IMAGE" && !v.imageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "图片章节必须提供 imageUrl",
        path: ["imageUrl"],
      });
    }
  });

export async function POST(req: Request, ctx: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await ctx.params;
  try {
    const auth = await requireFamilyWrite(familyId);
    const parsed = CreateSchema.safeParse((await readJson<unknown>(req)) ?? {});
    if (!parsed.success) return zodError(parsed.error);
    const d = parsed.data;

    // 封面为单例：已存在则应直接编辑，不重复创建
    if (d.kind === "COVER") {
      const existing = await prisma.albumSection.findFirst({
        where: { familyId, kind: "COVER" },
        select: { id: true },
      });
      if (existing) return conflict("COVER_EXISTS", "封面已存在，请直接编辑");
    }

    // 首次写自动 seed：DB 为空时先把默认章节落库，新章节才能追加在其后
    // （否则 resolveAlbumSections 会因"有记录"而丢弃所有虚拟默认项）。
    const count = await prisma.albumSection.count({ where: { familyId } });
    if (count === 0) {
      await prisma.albumSection.createMany({ data: defaultSectionCreateData(familyId) });
    }

    const agg = await prisma.albumSection.aggregate({
      where: { familyId },
      _max: { order: true },
    });
    const nextOrder = (agg._max.order ?? -1) + 1;

    const row = await prisma.albumSection.create({
      data: {
        familyId,
        kind: d.kind,
        title: d.title ?? null,
        subtitle: d.subtitle ?? null,
        body: d.body ?? null,
        signature: d.signature ?? null,
        imageUrl: d.imageUrl ?? null,
        order: nextOrder,
        enabled: true,
        appliesTo: d.appliesTo ?? [],
      },
    });

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "CREATE",
      entity: "AlbumSection",
      entityId: row.id,
      after: { kind: row.kind, title: row.title },
    });

    return NextResponse.json(
      { data: { ...row, imageUrl: row.imageUrl ? ossSignIfOurs(row.imageUrl) : null } },
      { status: 201 },
    );
  } catch (e) {
    return handleApiError(e);
  }
}
