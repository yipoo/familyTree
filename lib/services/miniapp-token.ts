/**
 * 小程序鉴权 token（HS256，自包含，放 Authorization: Bearer）。
 *
 * 小程序无 cookie 习惯，故不复用 web 的 Auth.js cookie session。
 * 用 node crypto 自签，不引第三方 JWT 库。
 *
 * 两类 token：
 *   - bind   ：登录拿到 openid 但还没绑手机号时的短时凭证（仅含 openid）
 *   - session：绑定后的正式登录 token（含 userId + openid）
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type MiniappTokenKind = "session" | "bind";

export interface MiniappClaims {
  openid: string;
  userId?: string;
  kind: MiniappTokenKind;
  exp: number; // 秒级时间戳
}

function secret(): string {
  return process.env.MINIAPP_JWT_SECRET || process.env.AUTH_SECRET || "dev-insecure-secret";
}

function b64url(s: Buffer | string): string {
  return Buffer.from(s).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function signToken(claims: Omit<MiniappClaims, "exp">, ttlSec: number): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + ttlSec }),
  );
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

export function verifyToken(token: string): MiniappClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = sign(`${h}.${p}`);
  const a = Buffer.from(s);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(p, "base64url").toString()) as MiniappClaims;
    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

/** 从 Authorization 头取出并校验 token。 */
export function readBearer(req: Request): MiniappClaims | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return verifyToken(m[1]);
}
