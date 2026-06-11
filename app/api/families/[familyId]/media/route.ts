/**
 * 媒体/影像
 *
 *   POST  (multipart/form-data)  上传一个文件（照片/文档/音频/视频）
 *         字段：file, personId?(挂到人物), caption?
 *   GET   ?personId=<id>         列出某人物影像；不传 = 家族级影像（personId 为空）
 *
 * 权限：上传/删除——挂人物则 requireWriteOnPerson，否则 requireFamilyWrite；
 *       读——家族成员。文件落 OSS（见 lib/services/oss.ts）。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireFamilyRole, requireFamilyWrite, requireWriteOnPerson } from "@/lib/auth/guard";
import { handleApiError, badRequest } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";
import {
  ossConfigured,
  ossSignIfOurs,
  uploadBuffer,
  buildMediaKey,
  mediaInfoFromMime,
} from "@/lib/services/oss";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB

export async function POST(req: Request, ctx: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await ctx.params;
  try {
    if (!ossConfigured()) {
      return badRequest("OSS_NOT_CONFIGURED", "对象存储未配置，无法上传（请联系管理员设置 OSS_*）");
    }

    const form = await req.formData();
    const file = form.get("file");
    const personId = (form.get("personId") as string | null)?.trim() || null;
    const caption = ((form.get("caption") as string | null) ?? "").trim().slice(0, 500) || null;

    // 权限：挂到人物则按人物写权限，否则家族写权限
    const auth = personId
      ? await requireWriteOnPerson(familyId, personId)
      : await requireFamilyWrite(familyId);

    if (!file || typeof file === "string") {
      return badRequest("NO_FILE", "缺少文件");
    }
    const blob = file as File;
    if (blob.size === 0) return badRequest("EMPTY_FILE", "空文件");
    if (blob.size > MAX_BYTES) return badRequest("TOO_LARGE", "文件超过 20MB 上限");

    const info = mediaInfoFromMime(blob.type);
    if (!info) return badRequest("UNSUPPORTED_TYPE", `不支持的文件类型：${blob.type || "未知"}`);

    // personId 若提供，校验属于本家族（writeOnPerson 已含权限，但未校 familyId 归属）
    if (personId) {
      const exists = await prisma.person.findFirst({
        where: { id: personId, familyId, deletedAt: null },
        select: { id: true },
      });
      if (!exists) return badRequest("BAD_PERSON", "人物不存在");
    }

    const buf = Buffer.from(await blob.arrayBuffer());
    const key = buildMediaKey(familyId, info.ext);
    const url = await uploadBuffer(key, buf, blob.type);

    const media = await prisma.media.create({
      data: {
        familyId,
        personId,
        kind: info.kind,
        url,
        objectKey: key,
        name: blob.name?.slice(0, 200) || null,
        mime: blob.type || null,
        size: blob.size,
        caption,
        uploadedById: auth.user.id,
      },
    });

    await writeAudit({
      familyId,
      actorId: auth.user.id,
      kind: "CREATE",
      entity: "Media",
      entityId: media.id,
      after: { kind: media.kind, name: media.name, personId },
    });

    return NextResponse.json(
      { data: { ...media, url: ossSignIfOurs(media.url) } },
      { status: 201 },
    );
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const personId = new URL(req.url).searchParams.get("personId");

    const list = await prisma.media.findMany({
      where: { familyId, personId: personId ?? null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    return NextResponse.json({
      data: list.map((m) => ({ ...m, url: ossSignIfOurs(m.url) })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
