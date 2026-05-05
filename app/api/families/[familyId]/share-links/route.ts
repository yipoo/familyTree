/**
 * GET   /api/families/[familyId]/share-links     列出所有分享链接（仅族长 / 管理员 / SUPERADMIN）
 * POST  /api/families/[familyId]/share-links     创建分享链接
 *
 * 创建参数：
 *   - ttl: "1d" | "7d" | "30d" | "180d" | "never"
 *   - scope: { kind: "all" } | { kind: "subtree", rootPersonId }
 *   - password?: string  可选访问密码（明文，存储为 bcrypt hash）
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { generateShareToken } from "@/lib/auth/share";
import { requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const TTL_MAP: Record<string, number | null> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "180d": 180,
  never: null,
};

const ScopeSchema = z.union([
  z.object({ kind: z.literal("all") }),
  z.object({
    kind: z.literal("subtree"),
    rootPersonId: z.string().min(1),
  }),
]);

const CreateSchema = z.object({
  ttl: z.enum(["1d", "7d", "30d", "180d", "never"]).default("30d"),
  scope: ScopeSchema.default({ kind: "all" }),
  password: z.string().min(4).max(64).optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyWrite(familyId);
    const links = await prisma.shareLink.findMany({
      where: { familyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        scope: true,
        expiresAt: true,
        passwordHash: true,
        createdBy: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      data: links.map((l) => ({
        id: l.id,
        token: l.token,
        scope: l.scope,
        expiresAt: l.expiresAt,
        hasPassword: !!l.passwordHash,
        createdBy: l.createdBy,
        createdAt: l.createdAt,
        expired: !!l.expiresAt && l.expiresAt.getTime() < Date.now(),
      })),
    });
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
    const ctxAuth = await requireFamilyWrite(familyId);
    const json = await readJson<unknown>(req);
    const parsed = CreateSchema.safeParse(json ?? {});
    if (!parsed.success) return zodError(parsed.error);

    const days = TTL_MAP[parsed.data.ttl];
    const expiresAt = days === null ? null : new Date(Date.now() + days * 86400000);

    // 若 scope 是 subtree，验证 rootPersonId 属于该家族
    if (parsed.data.scope.kind === "subtree") {
      const root = await prisma.person.findFirst({
        where: { id: parsed.data.scope.rootPersonId, familyId, deletedAt: null },
        select: { id: true },
      });
      if (!root) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "rootPersonId 不属于该家族" } },
          { status: 404 },
        );
      }
    }

    const passwordHash = parsed.data.password
      ? await hashPassword(parsed.data.password)
      : null;

    const link = await prisma.shareLink.create({
      data: {
        familyId,
        token: generateShareToken(),
        scope: parsed.data.scope,
        expiresAt,
        passwordHash,
        createdBy: ctxAuth.user.id,
      },
    });

    await writeAudit({
      familyId,
      actorId: ctxAuth.user.id,
      kind: "CREATE",
      entity: "ShareLink",
      entityId: link.id,
      after: { token: link.token, scope: link.scope, expiresAt: link.expiresAt },
    });

    return NextResponse.json(
      {
        data: {
          id: link.id,
          token: link.token,
          scope: link.scope,
          expiresAt: link.expiresAt,
          hasPassword: !!link.passwordHash,
          createdAt: link.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    return handleApiError(e);
  }
}
