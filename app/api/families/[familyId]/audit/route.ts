/**
 * GET /api/families/[familyId]/audit
 *
 * 列出审计日志。支持过滤：
 *   - entity: Person / Marriage / ParentChild / ShareLink / GenerationName / Family / ImportXlsx
 *   - entityId
 *   - kind: CREATE / UPDATE / DELETE / APPROVE / REJECT
 *   - actorId
 *   - sinceTs / untilTs (毫秒时间戳)
 *   - limit (默认 100，最大 500)
 *   - cursor (上一页最后一条 id，用于游标分页)
 *
 * 仅 ADMIN+。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, zodError } from "@/lib/api/error";

const QuerySchema = z.object({
  entity: z.string().optional(),
  entityId: z.string().optional(),
  kind: z.enum(["CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT"]).optional(),
  actorId: z.string().optional(),
  sinceTs: z.coerce.number().int().min(0).optional(),
  untilTs: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.string().optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyWrite(familyId);

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return zodError(parsed.error);
    const q = parsed.data;

    const where: Record<string, unknown> = { familyId };
    if (q.entity) where.entity = q.entity;
    if (q.entityId) where.entityId = q.entityId;
    if (q.kind) where.kind = q.kind;
    if (q.actorId) where.actorId = q.actorId;
    if (q.sinceTs || q.untilTs) {
      const range: Record<string, Date> = {};
      if (q.sinceTs) range.gte = new Date(q.sinceTs);
      if (q.untilTs) range.lte = new Date(q.untilTs);
      where.createdAt = range;
    }

    const list = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });

    const hasMore = list.length > q.limit;
    const items = hasMore ? list.slice(0, q.limit) : list;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // 拼 actor 名字
    const actorIds = [...new Set(items.map((a) => a.actorId))];
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, phone: true },
        })
      : [];
    const actorById = new Map(actors.map((u) => [u.id, u]));

    return NextResponse.json({
      data: {
        items: items.map((a) => ({
          ...a,
          actor: actorById.get(a.actorId) ?? null,
        })),
        nextCursor,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
