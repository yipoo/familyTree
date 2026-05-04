/**
 * GET /api/families/[familyId]/stats
 *
 * 返回族级统计；逻辑在 lib/services/family-stats.ts，与 SSR 页面共享。
 */
import { NextResponse } from "next/server";

import { requireFamilyRole } from "@/lib/auth/guard";
import { handleApiError } from "@/lib/api/error";
import { computeFamilyStats } from "@/lib/services/family-stats";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const data = await computeFamilyStats(familyId);
    if (!data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Family not found" } },
        { status: 404 },
      );
    }
    return NextResponse.json({ data });
  } catch (e) {
    return handleApiError(e);
  }
}
