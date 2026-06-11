/**
 * 登录路由（绕过 server action）：
 *  1. 校验"手机号或邮箱"+ 密码（直接读 prisma + verifyPassword）
 *  2. 用 @auth/core/jwt 的 encode 手工签发 Auth.js 同款 session JWT
 *  3. 在响应里 Set-Cookie 同时 303 → next
 *
 * 这样彻底避开 Next.js 16 + Auth.js v5 在 server action 内 signIn(redirectTo) 触发的
 * "An unexpected response was received from the server"。
 *
 * 入参（multipart/form-data 或 application/x-www-form-urlencoded）：
 *   - identifier   手机号 或 邮箱（首选；与 phone 任填其一）
 *   - phone        手机号（兼容旧表单）
 *   - email        邮箱（兼容写法）
 *   - password     密码
 *   - next         登录后跳转的目标路径（默认 "/"）
 */
import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";

import { prisma } from "@/lib/db";
import { normalizePhone, verifyPassword } from "@/lib/auth/password";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { publicUrl, sessionCookie } from "@/lib/api/public-url";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loginHandler(req: Request) {
  const formData = await req.formData();
  const identifier =
    String(formData.get("identifier") ?? formData.get("phone") ?? formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";

  const fail = (code: "missing" | "invalid") =>
    NextResponse.redirect(
      publicUrl(req, `/login?error=${code}&next=${encodeURIComponent(next)}`),
      303,
    );

  if (!identifier || !password) return fail("missing");

  // 识别是邮箱还是手机号
  let user: Awaited<ReturnType<typeof prisma.user.findUnique>> | null = null;
  if (EMAIL_RE.test(identifier)) {
    user = await prisma.user.findUnique({
      where: { email: identifier.toLowerCase() },
    });
  } else {
    const phone = normalizePhone(identifier);
    if (!phone) return fail("invalid");
    user = await prisma.user.findUnique({ where: { phone } });
  }

  if (!user || !user.passwordHash) return fail("invalid");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return fail("invalid");

  const token = {
    uid: user.id,
    phone: user.phone,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    sub: user.id,
  };

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");

  const cookie = sessionCookie(req);
  const encoded = await encode({
    token,
    secret,
    salt: cookie.name,
    maxAge: SESSION_MAX_AGE,
  });

  const target = publicUrl(req, next);
  const res = NextResponse.redirect(target, 303);
  res.cookies.set(cookie.name, encoded, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: cookie.secure,
  });
  return res;
}

// 限流：单 IP 每分钟最多 10 次登录尝试。登录失败一次也计数。
export const POST = withRateLimit(loginHandler, {
  bucket: "login",
  limit: 10,
  windowMs: 60_000,
});
