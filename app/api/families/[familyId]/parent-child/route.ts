/**
 * GET  /api/families/[familyId]/parent-child         列出（可按 parentId / childId 过滤）
 * POST /api/families/[familyId]/parent-child         新建一条亲子关系
 *
 * 写权限：对 child 拥有写权限即可（这是覆盖父系祖先的常见情形）
 *
 * 注意：existing PATCH /persons/:id/parents 仍可用于"替换式"父母编辑；
 * 这套独立资源 API 适合管理过继 / 多重关系（如 BIOLOGICAL + ADOPTED 共存）。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  requireFamilyRole,
  requireUser,
  AuthError,
  canWriteOnPerson,
} from "@/lib/auth/guard";
import { handleApiError, readJson, zodError, conflict } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const CreateSchema = z.object({
  parentId: z.string().min(1),
  childId: z.string().min(1),
  relation: z.enum(["BIOLOGICAL", "ADOPTED", "FOSTER", "STEP"]).default("BIOLOGICAL"),
  birthOrder: z.number().int().min(0).max(100).nullable().optional(),
  isPrimary: z.boolean().optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
    const url = new URL(req.url);
    const parentId = url.searchParams.get("parentId");
    const childId = url.searchParams.get("childId");
    const where: Record<string, unknown> = { familyId };
    if (parentId) where.parentId = parentId;
    if (childId) where.childId = childId;

    const list = await prisma.parentChild.findMany({
      where,
      orderBy: [{ childId: "asc" }, { isPrimary: "desc" }],
      include: {
        parent: { select: { id: true, name: true, gender: true } },
        child: { select: { id: true, name: true, gender: true } },
      },
    });
    return NextResponse.json({ data: list });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    const me = await requireUser();
    const json = await readJson<unknown>(req);
    const parsed = CreateSchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);
    const body = parsed.data;

    if (body.parentId === body.childId) {
      return conflict("INVALID", "parentId 与 childId 不能相同");
    }

    const [parent, child] = await Promise.all([
      prisma.person.findFirst({
        where: { id: body.parentId, familyId, deletedAt: null },
      }),
      prisma.person.findFirst({
        where: { id: body.childId, familyId, deletedAt: null },
      }),
    ]);
    if (!parent || !child) {
      return conflict("NOT_FOUND", "父或子不存在或不属于该家族");
    }

    // 写权限：对子或父任一有写权限即可
    const can =
      (await canWriteOnPerson(me, familyId, body.childId)) ||
      (await canWriteOnPerson(me, familyId, body.parentId));
    if (!can) throw new AuthError(403, "FORBIDDEN", "无权创建该亲子关系");

    // 防环：parent 不能是 child 的后代
    const descendants = await collectDescendants(familyId, body.childId);
    if (descendants.has(body.parentId)) {
      return conflict("CYCLE", "不能在祖先链上形成环");
    }

    // 同 (parent, child, relation) 唯一
    const dup = await prisma.parentChild.findFirst({
      where: {
        parentId: body.parentId,
        childId: body.childId,
        relation: body.relation,
      },
    });
    if (dup) return conflict("DUPLICATE", "同一关系类型已存在");

    // 若 isPrimary 为 true 且子已有同性别 primary，先置为 non-primary
    let isPrimary = body.isPrimary ?? body.relation === "BIOLOGICAL";
    if (isPrimary) {
      await prisma.parentChild.updateMany({
        where: {
          familyId,
          childId: body.childId,
          isPrimary: true,
          parent: { gender: parent.gender },
        },
        data: { isPrimary: false },
      });
    } else {
      // 否则保持原样
      isPrimary = false;
    }

    const created = await prisma.parentChild.create({
      data: {
        familyId,
        parentId: body.parentId,
        childId: body.childId,
        relation: body.relation,
        birthOrder: body.birthOrder ?? null,
        isPrimary,
      },
    });

    await writeAudit({
      familyId,
      actorId: me.id,
      kind: "CREATE",
      entity: "ParentChild",
      entityId: created.id,
      after: created,
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

async function collectDescendants(familyId: string, rootId: string): Promise<Set<string>> {
  const all = await prisma.parentChild.findMany({
    where: { familyId },
    select: { parentId: true, childId: true },
  });
  const adj = new Map<string, string[]>();
  for (const e of all) {
    const arr = adj.get(e.parentId) ?? [];
    arr.push(e.childId);
    adj.set(e.parentId, arr);
  }
  const out = new Set<string>();
  const queue = [rootId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const c of adj.get(cur) ?? []) {
      if (!out.has(c)) {
        out.add(c);
        queue.push(c);
      }
    }
  }
  return out;
}
