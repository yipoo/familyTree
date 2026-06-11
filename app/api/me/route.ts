/**
 * GET   /api/me   当前用户信息 + 所属家族列表
 * PATCH /api/me   更新昵称、头像
 *
 * 与 Auth.js 的 session 不同，这里返回的是 prisma 真相 + 关系汇总——前端 /me 页 / 顶栏头像菜单可直接消费。
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { handleApiError, readJson, zodError } from "@/lib/api/error";

const PatchSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    avatarUrl: z
      .string()
      .url()
      .max(500)
      .nullable()
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "至少修改一项");

export async function GET() {
  try {
    const me = await requireUser();
    const [user, memberships] = await Promise.all([
      prisma.user.findUnique({
        where: { id: me.id },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          avatarUrl: true,
          platformRole: true,
          createdAt: true,
        },
      }),
      prisma.familyMember.findMany({
        where: { userId: me.id, family: { deletedAt: null } },
        orderBy: { joinedAt: "asc" },
        include: {
          family: {
            select: {
              id: true,
              surname: true,
              name: true,
              founderName: true,
              isPublic: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        user,
        families: memberships.map((m) => ({
          ...m.family,
          myRole: m.role,
          joinedAt: m.joinedAt,
        })),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const me = await requireUser();
    const json = await readJson<unknown>(req);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);

    const updated = await prisma.user.update({
      where: { id: me.id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatarUrl: true,
        platformRole: true,
      },
    });
    return NextResponse.json({ data: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
