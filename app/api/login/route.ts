/**
 * 登录路由（绕过 server action）：
 *  1. 校验手机号 + 密码（直接读 prisma + verifyPassword）
 *  2. 用 @auth/core/jwt 的 encode 手工签发 Auth.js 同款 session JWT
 *  3. 在响应里 Set-Cookie 同时 303 → next
 *
 * 这样彻底避开 Next.js 16 + Auth.js v5 在 server action 内 signIn(redirectTo) 触发的
 * "An unexpected response was received from the server"。
 */
import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";

import { prisma } from "@/lib/db";
import { normalizePhone, verifyPassword } from "@/lib/auth/password";

const SESSION_COOKIE = "authjs.session-token"; // 与 Auth.js 在非 secure 环境下一致
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 天，与 auth.config.ts 对齐
const SALT = SESSION_COOKIE; // Auth.js encode 默认 salt = cookieName

export async function POST(req: Request) {
  const formData = await req.formData();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";

  const fail = (code: "missing" | "invalid") =>
    NextResponse.redirect(
      new URL(`/login?error=${code}&next=${encodeURIComponent(next)}`, req.url),
      303,
    );

  if (!phoneRaw || !password) return fail("missing");

  const phone = normalizePhone(phoneRaw);
  if (!phone) return fail("invalid");

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.passwordHash) return fail("invalid");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return fail("invalid");

  // 与 auth.ts 的 jwt callback 字段保持一致
  const token = {
    uid: user.id,
    phone: user.phone,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    sub: user.id,
  };

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");

  const encoded = await encode({
    token,
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
    // dev 走 http，不要打 secure 标
    secure: req.url.startsWith("https://"),
  });
  return res;
}
