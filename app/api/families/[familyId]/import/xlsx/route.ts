/**
 * POST /api/families/[familyId]/import/xlsx
 *
 * multipart/form-data
 *   - file: 上传的 .xlsx 文件
 *   - mode: "dry" | "apply"   默认 "apply"
 *
 * 仅族长 / 管理员 / SUPERADMIN 可调用。
 * dry 模式只返回预估，不落库；apply 模式真正写入。
 */
import { NextResponse } from "next/server";

import { requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, badRequest } from "@/lib/api/error";
import { parseXlsxBuffer } from "@/lib/services/xlsx-import";
import { dryRunImport, runImport } from "@/lib/services/xlsx-import-runner";
import { writeAudit } from "@/lib/services/audit";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// 单个文件可能很大，提高超时（Node runtime 默认 60s）
export const maxDuration = 300;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    const ctxAuth = await requireFamilyWrite(familyId);

    const form = await req.formData();
    const file = form.get("file");
    const mode = String(form.get("mode") ?? "apply");

    if (!(file instanceof File)) {
      return badRequest("VALIDATION_FAILED", "file 必填且应为文件");
    }
    if (file.size > MAX_BYTES) {
      return badRequest(
        "FILE_TOO_LARGE",
        `文件超过 ${MAX_BYTES / 1024 / 1024} MB 上限`,
      );
    }
    if (
      !file.name.endsWith(".xlsx") &&
      !file.name.endsWith(".xlsm") &&
      file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      return badRequest("VALIDATION_FAILED", "仅支持 .xlsx / .xlsm 文件");
    }
    if (mode !== "dry" && mode !== "apply") {
      return badRequest("VALIDATION_FAILED", `mode 必须是 dry 或 apply`);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = await parseXlsxBuffer(buf);

    if (mode === "dry") {
      const dry = await dryRunImport(familyId, parsed);
      return NextResponse.json({
        data: {
          mode: "dry",
          rowCount: parsed.rows.length,
          ...dry,
        },
      });
    }

    const stats = await runImport(familyId, parsed);
    await writeAudit({
      familyId,
      actorId: ctxAuth.user.id,
      kind: "CREATE",
      entity: "ImportXlsx",
      entityId: `${familyId}:${Date.now()}`,
      after: { fileName: file.name, ...stats },
    });

    return NextResponse.json({
      data: {
        mode: "apply",
        rowCount: parsed.rows.length,
        ...stats,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
