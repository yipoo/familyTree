/**
 * 注册路由：手机号或邮箱 + 密码 + 昵称。
 *
 * 入参：
 *   - phone      （二选一）
 *   - email      （二选一）
 *   - password   密码（≥6 位）
 *   - name       昵称
 *   - next       注册成功后跳转
 */
import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";

import { prisma } from "@/lib/db";
import { hashPassword, normalizePhone } from "@/lib/auth/password";
import { withRateLimit } from "@/lib/rate-limit-middleware";

const SESSION_COOKIE = "authjs.session-token";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const SALT = SESSION_COOKIE;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function registerHandler(req: Request) {
  const formData = await req.formData();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const next = String(formData.get("next") ?? "/") || "/";

  const fail = (code: "missing" | "short" | "taken" | "regfail" | "invalid_email") =>
    NextResponse.redirect(
      new URL(`/register?error=${code}&next=${encodeURIComponent(next)}`, req.url),
      303,
    );

  if (!password || !name) return fail("missing");
  if (password.length < 6) return fail("short");
  if (!phoneRaw && !emailRaw) return fail("missing");

  let phone: string | null = null;
  let email: string | null = null;
  if (phoneRaw) {
    phone = normalizePhone(phoneRaw);
    if (!phone) return fail("regfail");
  }
  if (emailRaw) {
    if (!EMAIL_RE.test(emailRaw)) return fail("invalid_email");
    email = emailRaw.toLowerCase();
  }

  // 唯一性
  if (phone) {
    const exists = await prisma.user.findUnique({ where: { phone } });
    if (exists) return fail("taken");
  }
  if (email) {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return fail("taken");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { phone, email, passwordHash, name },
  });

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

// 限流：单 IP 每分钟最多 5 次注册（注册比登录贵）。
export const POST = withRateLimit(registerHandler, {
  bucket: "register",
  limit: 5,
  windowMs: 60_000,
});
