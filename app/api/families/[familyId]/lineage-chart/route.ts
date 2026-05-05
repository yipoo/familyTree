/**
 * GET /api/families/[familyId]/lineage-chart?root=PID
 *
 * 返回吊线图所需的布局数据（节点 + 连线）。
 * 仅父系下钻（男性后代 + 配偶简注）。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireFamilyRole } from "@/lib/auth/guard";
import { handleApiError } from "@/lib/api/error";
import { layoutLineageChart } from "@/lib/services/lineage-chart";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");

    const url = new URL(req.url);
    const rootParam = url.searchParams.get("root");

    const [family, persons, marriages, parentChild] = await Promise.all([
      prisma.family.findUnique({
        where: { id: familyId },
        include: {
          generationNames: { orderBy: { generation: "asc" } },
          branches: {
            orderBy: { name: "asc" },
            include: { rootPerson: true },
          },
        },
      }),
      prisma.person.findMany({
        where: { familyId, deletedAt: null },
        select: {
          id: true,
          name: true,
          alias: true,
          generation: true,
          generationChar: true,
          gender: true,
          isMarriedIn: true,
          birthOrder: true,
          birthYear: true,
          deathYear: true,
          status: true,
          succession: true,
        },
      }),
      prisma.marriage.findMany({
        where: { familyId },
        select: {
          husbandId: true,
          wifeId: true,
          type: true,
          order: true,
        },
      }),
      prisma.parentChild.findMany({
        where: { familyId },
        select: { parentId: true, childId: true, birthOrder: true },
      }),
    ]);

    if (!family) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Family not found" } },
        { status: 404 },
      );
    }

    // 选根：参数优先，否则首支系 root，否则最低世代 MALE
    let rootId: string | null = null;
    if (rootParam) {
      const exists = persons.find((p) => p.id === rootParam);
      if (exists) rootId = exists.id;
    }
    if (!rootId) {
      rootId = family.branches[0]?.rootPersonId ?? null;
    }
    if (!rootId) {
      const minGen = persons.reduce(
        (m, p) => Math.min(m, p.generation),
        Number.POSITIVE_INFINITY,
      );
      rootId = persons.find((p) => p.generation === minGen && p.gender === "MALE")?.id
        ?? persons.find((p) => p.generation === minGen)?.id
        ?? null;
    }
    if (!rootId) {
      return NextResponse.json({
        data: {
          family: { id: family.id, name: family.name, surname: family.surname },
          rootPersonId: null,
          rootPersonName: "",
          generationChars: {},
          layout: null,
        },
      });
    }

    const layout = layoutLineageChart({
      rootPersonId: rootId,
      persons,
      parentChild,
      marriages,
    });

    const generationChars = Object.fromEntries(
      family.generationNames.map((g) => [g.generation, g.character]),
    );

    return NextResponse.json({
      data: {
        family: { id: family.id, name: family.name, surname: family.surname },
        rootPersonId: rootId,
        rootPersonName: persons.find((p) => p.id === rootId)?.name ?? "",
        generationChars,
        layout,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
