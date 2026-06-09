/**
 * 反向代理 / Cloudflare Tunnel 场景下，`req.url` 的 host 来自 `Host` 头，
 * 而 cloudflared 默认会把 `Host` 改写成 origin（如 `localhost:3000`）。
 * 直接 `new URL(path, req.url)` 做 303 跳转会跳到 localhost。
 *
 * 优先用 `X-Forwarded-Host` / `X-Forwarded-Proto` 还原对外 URL；
 * 没有这些头时退化为 `req.url`。
 */
export function publicUrl(req: Request, path: string): URL {
  const h = req.headers;
  const fwdHost = h.get("x-forwarded-host");
  const fwdProto = h.get("x-forwarded-proto");
  if (fwdHost) {
    const proto = fwdProto ?? (req.url.startsWith("https") ? "https" : "http");
    return new URL(path, `${proto}://${fwdHost}`);
  }
  return new URL(path, req.url);
}

/**
 * 根据对外协议返回 Auth.js 默认的 session cookie 名 + secure 标志。
 * Auth.js v5 在 https 环境下默认会用 `__Secure-` 前缀，且只认这个名。
 * 这里必须和 Auth.js 内部行为保持一致，否则手工签发的 cookie 读不到。
 */
export function sessionCookie(req: Request): { name: string; secure: boolean } {
  const isHttps = publicUrl(req, "/").protocol === "https:";
  return {
    name: isHttps ? "__Secure-authjs.session-token" : "authjs.session-token",
    secure: isHttps,
  };
}
