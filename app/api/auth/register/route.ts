import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { hashPassword, normalizePhone } from "@/lib/auth/password";

const bodySchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(6).max(128),
  name: z.string().trim().min(1).max(40),
});

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "参数不合法" } },
      { status: 400 },
    );
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "手机号格式不正确" } },
      { status: 400 },
    );
  }

  const exists = await prisma.user.findUnique({ where: { phone } });
  if (exists) {
    return NextResponse.json(
      { error: { code: "PHONE_TAKEN", message: "该手机号已注册" } },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: { phone, passwordHash, name: parsed.data.name },
    select: { id: true, phone: true, name: true },
  });

  // 注：新用户仅创建平台账号，不自动加入任何家族。
  // 用户登录后须凭邀请码（FamilyInvite）加入家族，或自行创建新家族。

  return NextResponse.json({ data: user }, { status: 201 });
}
