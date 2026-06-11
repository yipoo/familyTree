/**
 * POST /api/families/[familyId]/audit/[auditId]/undo
 *
 * 撤回某条审计日志对应的写操作。详细策略见 lib/services/undo.ts。
 */
import { NextResponse } from "next/server";

import { requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError } from "@/lib/api/error";
import { undoAudit } from "@/lib/services/undo";

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  TOO_OLD: 422,
  UNSUPPORTED: 422,
  ALREADY_REVERTED: 409,
  STATE_CONFLICT: 409,
};

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ familyId: string; auditId: string }> },
) {
  const { familyId, auditId } = await ctx.params;
  try {
    const auth = await requireFamilyWrite(familyId);
    const r = await undoAudit({ familyId, auditId, actorId: auth.user.id });
    if (!r.ok) {
      return NextResponse.json(
        { error: { code: r.code, message: r.message } },
        { status: STATUS_BY_CODE[r.code] ?? 400 },
      );
    }
    return NextResponse.json({ data: { ok: true, message: r.message } });
  } catch (e) {
    return handleApiError(e);
  }
}
