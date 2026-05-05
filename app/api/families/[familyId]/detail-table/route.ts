/**
 * GET /api/families/[familyId]/detail-table
 *
 * 把"详细图"（即一行一个家庭单元的表格视图）所需数据独立成 API。
 * 用途：客户端导出 / 第三方集成 / 替代 SSR 直读 prisma 的页面。
 *
 * 查询参数：
 *   - lineage: paternal | maternal | all（默认 paternal）
 *   - branchId: 仅某支系（可选）
 *   - generation: 仅某世（可选）
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyRole } from "@/lib/auth/guard";
import { handleApiError, zodError } from "@/lib/api/error";
import { buildFamilyUnits } from "@/lib/services/family-units";
import { parseLineage } from "@/lib/services/lineage";

const QuerySchema = z.object({
  lineage: z.enum(["paternal", "maternal", "all"]).optional(),
  branchId: z.string().optional(),
  generation: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return zodError(parsed.error);
    const { branchId, generation } = parsed.data;
    const lineage = parseLineage(parsed.data.lineage);

    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: {
        generationNames: { orderBy: { generation: "asc" } },
      },
    });
    if (!family) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Family not found" } },
        { status: 404 },
      );
    }

    const baseWhere: Record<string, unknown> = { familyId, deletedAt: null };
    if (branchId) baseWhere.branchId = branchId;

    const [persons, marriages, parentChild] = await Promise.all([
      prisma.person.findMany({ where: baseWhere }),
      prisma.marriage.findMany({ where: { familyId } }),
      prisma.parentChild.findMany({ where: { familyId } }),
    ]);

    const allUnits = buildFamilyUnits({
      persons: persons.map((p) => ({
        id: p.id,
        name: p.name,
        gender: p.gender,
        generation: p.generation,
        generationChar: p.generationChar,
        status: p.status,
        isMarriedIn: p.isMarriedIn,
      })),
      marriages,
      parentChild: parentChild.map((pc) => ({
        parentId: pc.parentId,
        childId: pc.childId,
        birthOrder: pc.birthOrder,
      })),
    });

    let units = allUnits;

    // generation 过滤
    if (generation != null) {
      units = units.filter((u) => u.generation === generation);
    }

    // lineage 过滤
    if (lineage === "maternal") {
      units = units
        .map((u) => ({
          ...u,
          children: u.children.filter((c) => c.person.gender === "FEMALE"),
        }))
        .filter((u) => u.children.length > 0);
    } else if (lineage === "all") {
      // 不过滤
    } else {
      // paternal：保留全部 unit（dad-led），但子女是 paternal 已包含
    }

    const generationChars = Object.fromEntries(
      family.generationNames.map((g) => [g.generation, g.character]),
    );

    return NextResponse.json({
      data: {
        family: { id: family.id, name: family.name, surname: family.surname },
        lineage,
        generation: generation ?? null,
        branchId: branchId ?? null,
        units,
        generationChars,
        stats: {
          totalUnits: units.length,
          totalPersons: persons.length,
        },
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
