/**
 * 二维码采集 —— 公开端点（无需登录）
 *
 *   GET  /api/collect/[token]   解析采集链接：返回模式 + 家族/目标人物信息（+ 现有可编辑字段）
 *   POST /api/collect/[token]   族人提交 → 进 PendingSubmission 审核队列
 *
 * 提交不直接落库，统一进审核流（族长/管理员在后台「待审提交」批准后生效）。
 * 提交人身份（姓名/电话/关系）随 payload.contributor 存储，submitterId 记为建链人。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { handleApiError, readJson, zodError, badRequest, notFound, forbidden } from "@/lib/api/error";
import {
  diffPersonUpdate,
  type SubmissionPayload,
  type Contributor,
} from "@/lib/services/submissions";
import { hashPhone } from "@/lib/services/phone";

async function resolveLink(token: string) {
  const link = await prisma.collectionLink.findUnique({
    where: { token },
    include: {
      family: { select: { id: true, name: true, surname: true } },
      person: {
        select: {
          id: true,
          name: true,
          alias: true,
          gender: true,
          generation: true,
          generationChar: true,
          birthOrder: true,
          birthYear: true,
          deathYear: true,
          birthPlace: true,
          status: true,
          note: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!link) return { error: "NOT_FOUND" as const };
  if (link.revokedAt) return { error: "REVOKED" as const };
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return { error: "EXPIRED" as const };
  if (link.maxUses != null && link.uses >= link.maxUses) return { error: "EXHAUSTED" as const };
  if (link.person.deletedAt) return { error: "NOT_FOUND" as const };
  return { link };
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const r = await resolveLink(token);
    if (r.error) {
      const msg =
        r.error === "EXPIRED"
          ? "采集链接已过期"
          : r.error === "REVOKED"
            ? "采集链接已停用"
            : r.error === "EXHAUSTED"
              ? "采集链接已达使用上限"
              : "采集链接无效";
      return notFound(msg);
    }
    const { link } = r;
    return NextResponse.json({
      data: {
        mode: link.mode,
        note: link.note,
        family: { name: link.family.name, surname: link.family.surname },
        person: {
          id: link.person.id,
          name: link.person.name,
          generation: link.person.generation,
          generationChar: link.person.generationChar,
          // person-update 模式：回填现有可编辑字段
          current:
            link.mode === "PERSON_UPDATE"
              ? {
                  name: link.person.name,
                  alias: link.person.alias,
                  birthYear: link.person.birthYear,
                  deathYear: link.person.deathYear,
                  birthPlace: link.person.birthPlace,
                  status: link.person.status,
                  note: link.person.note,
                }
              : null,
        },
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

const ContributorSchema = z.object({
  name: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  relation: z.string().trim().max(40).optional(),
});

const UpdateBody = z.object({
  contributor: ContributorSchema.optional(),
  changes: z.record(z.string(), z.unknown()),
  phone: z.string().trim().max(40).optional(), // 联系手机号（哈希后存，用于小程序自动定位）
});

const AddChildBody = z.object({
  contributor: ContributorSchema.optional(),
  child: z.object({
    name: z.string().trim().min(1).max(100),
    gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]),
    birthYear: z.number().int().nullable().optional(),
    birthPlace: z.string().trim().max(200).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  }),
});

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const r = await resolveLink(token);
    if (r.error) return forbidden("LINK_INVALID", "采集链接已失效");
    const { link } = r;

    const json = (await readJson<unknown>(req)) ?? {};

    let payload: SubmissionPayload | null = null;

    if (link.mode === "PERSON_UPDATE") {
      const parsed = UpdateBody.safeParse(json);
      if (!parsed.success) return zodError(parsed.error);

      const original = {
        name: link.person.name,
        alias: link.person.alias,
        birthOrder: link.person.birthOrder,
        status: link.person.status,
        birthYear: link.person.birthYear,
        deathYear: link.person.deathYear,
        birthPlace: link.person.birthPlace,
        note: link.person.note,
      };
      const fd = new FormData();
      for (const [k, v] of Object.entries(parsed.data.changes)) {
        fd.set(k, v === null || v === undefined ? "" : String(v));
      }
      const changes = diffPersonUpdate(original as Record<string, unknown>, fd);
      const contactPhoneHash = parsed.data.phone ? hashPhone(parsed.data.phone) : null;
      if (Object.keys(changes).length === 0 && !contactPhoneHash) {
        return badRequest("NO_CHANGES", "没有任何变更");
      }
      payload = {
        kind: "person-update",
        personId: link.person.id,
        personName: link.person.name,
        changes,
        source: "collect",
        contributor: parsed.data.contributor as Contributor | undefined,
        ...(contactPhoneHash ? { contactPhoneHash } : {}),
      };
    } else {
      // ADD_CHILD
      const parsed = AddChildBody.safeParse(json);
      if (!parsed.success) return zodError(parsed.error);
      payload = {
        kind: "person-add-child",
        parentId: link.person.id,
        parentName: link.person.name,
        child: {
          name: parsed.data.child.name,
          gender: parsed.data.child.gender,
          birthYear: parsed.data.child.birthYear ?? null,
          birthPlace: parsed.data.child.birthPlace ?? null,
          note: parsed.data.child.note ?? null,
        },
        source: "collect",
        contributor: parsed.data.contributor as Contributor | undefined,
      };
    }

    await prisma.$transaction([
      prisma.pendingSubmission.create({
        data: {
          familyId: link.familyId,
          submitterId: link.createdById, // 无登录态：记为建链人，真实填写人在 contributor
          payload: payload as unknown as object,
          status: "PENDING",
        },
      }),
      prisma.collectionLink.update({
        where: { id: link.id },
        data: { uses: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ data: { ok: true } }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
