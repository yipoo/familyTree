/**
 * 注册路由：复用 /api/auth/register 创建用户，再手动签发 session cookie + 303 跳转。
 * 与 /api/login 同样思路，避开 server action 的 redirect 报错。
 */
import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";

import { prisma } from "@/lib/db";
import { hashPassword, normalizePhone } from "@/lib/auth/password";

const SESSION_COOKIE = "authjs.session-token";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const SALT = SESSION_COOKIE;

export async function POST(req: Request) {
  const formData = await req.formData();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const next = String(formData.get("next") ?? "/") || "/";

  const fail = (code: "missing" | "short" | "taken" | "regfail") =>
    NextResponse.redirect(
      new URL(`/register?error=${code}&next=${encodeURIComponent(next)}`, req.url),
      303,
    );

  if (!phoneRaw || !password || !name) return fail("missing");
  if (password.length < 6) return fail("short");

  const phone = normalizePhone(phoneRaw);
  if (!phone) return fail("regfail");

  const exists = await prisma.user.findUnique({ where: { phone } });
  if (exists) return fail("taken");

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { phone, passwordHash, name },
  });

  // 新用户仅创建平台账号，不自动加入任何家族；登录后凭邀请码加入。

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");

  const encoded = await encode({
    token: {
      uid: user.id,
      phone: user.phone,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      sub: user.id,
    },
    secret,
    salt: SALT,
    maxAge: SESSION_MAX_AGE,
  });

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(SESSION_COOKIE, encoded, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: req.url.startsWith("https://"),
  });
  return res;
}
