/**
 * GET /api/discover?q=...
 *
 * 公开接口：列出所有 isPublic = true 的家族（用于 /discover 发现页）。
 * 不要求登录，但限流防止匿名扫描。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/api/error";
import { withRateLimit } from "@/lib/rate-limit-middleware";

async function discoverHandler(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const where: Record<string, unknown> = {
      isPublic: true,
      deletedAt: null,
    };
    if (q) {
      where.OR = [
        { surname: { contains: q } },
        { name: { contains: q } },
        { description: { contains: q } },
      ];
    }
    const families = await prisma.family.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        surname: true,
        name: true,
        founderName: true,
        description: true,
        createdAt: true,
        _count: {
          select: { persons: true, members: true, branches: true },
        },
      },
    });
    return NextResponse.json({ data: families });
  } catch (e) {
    return handleApiError(e);
  }
}

export const GET = withRateLimit(discoverHandler, {
  bucket: "discover",
  limit: 60,
  windowMs: 60_000,
});
