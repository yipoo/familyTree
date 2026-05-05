/**
 * 短信验证码登录 / 自动注册路由（form POST，303 跳转）。
 *
 *   1. 校验 phone + code
 *   2. 已注册 → 取 user
 *      未注册 → 自动创建 User（默认 name = "用户" + 手机后4位）
 *               不自动加入任何家族；引导到 /me?welcome=1 让用户输邀请码
 *   3. 签发与 /api/login 相同的 Auth.js session JWT cookie
 *   4. 303 → next（默认 /me?welcome=1 当首次注册）
 *
 * 与 /api/login 同样的"绕过 server action redirect"思路。
 */
import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";

import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/auth/password";
import { verifyCode } from "@/lib/services/verification";
import { withRateLimit } from "@/lib/rate-limit-middleware";

const SESSION_COOKIE = "authjs.session-token";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const SALT = SESSION_COOKIE;

async function loginCodeHandler(req: Request) {
  const formData = await req.formData();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const codeRaw = String(formData.get("code") ?? "").trim();
  const next = String(formData.get("next") ?? "") || "/";

  const fail = (code: string, defaultNext = next) =>
    NextResponse.redirect(
      new URL(
        `/login?error=${code}&mode=code&phone=${encodeURIComponent(
          phoneRaw,
        )}&next=${encodeURIComponent(defaultNext)}`,
        req.url,
      ),
      303,
    );

  if (!phoneRaw || !codeRaw) return fail("missing");

  const phone = normalizePhone(phoneRaw);
  if (!phone) return fail("invalid_phone");
  if (!/^\d{6}$/.test(codeRaw)) return fail("invalid_code");

  const v = await verifyCode(phone, "LOGIN", codeRaw);
  if (!v.ok) {
    return fail(v.code.toLowerCase());
  }

  // 已注册？
  let user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, phone: true, name: true, avatarUrl: true },
  });
  let firstTime = false;
  if (!user) {
    firstTime = true;
    const tail = phone.slice(-4);
    user = await prisma.user.create({
      data: {
        phone,
        name: `用户${tail}`,
        // passwordHash 留 null，用户后续可在 /me 设置密码
      },
      select: { id: true, phone: true, name: true, avatarUrl: true },
    });
  }

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

  // 首次注册引导到 /me?welcome=1（除非外部明确要求 next）
  const target = firstTime && next === "/" ? "/me?welcome=1" : next;
  const res = NextResponse.redirect(new URL(target, req.url), 303);
  res.cookies.set(SESSION_COOKIE, encoded, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: req.url.startsWith("https://"),
  });
  return res;
}

// 限流：单 IP 每分钟最多 10 次验证码登录尝试。
export const POST = withRateLimit(loginCodeHandler, {
  bucket: "login-code",
  limit: 10,
  windowMs: 60_000,
});
