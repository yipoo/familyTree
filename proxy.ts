import { NextRequest, NextResponse } from "next/server";

/**
 * 轻量门禁：只判定 session cookie 是否存在；真正的解码 / 角色校验由页面 / API 路由
 * 在 Node 运行时里通过 `auth()` + Prisma 二次确认。
 *
 * 这样避免 Auth.js v5 在 edge runtime 里偶发的 cookie 解码 / 环境差异，登录态认定
 * 完全统一在 Node 侧。
 */

const PUBLIC = (pathname: string) =>
  pathname === "/" ||
  pathname === "/pricing" ||
  pathname === "/features" ||
  pathname === "/about" ||
  pathname === "/login" ||
  pathname === "/register" ||
  pathname === "/discover" ||
  pathname === "/api/discover" ||
  pathname === "/api/login" ||
  pathname === "/api/login-code" ||
  pathname === "/api/register" ||
  pathname === "/api/sms/send-code" ||
  pathname.startsWith("/api/auth/") ||
  pathname.startsWith("/share/") ||
  pathname === "/join" ||
  pathname.startsWith("/join/") ||
  // 二维码采集：族人无需登录即可填写
  pathname.startsWith("/collect/") ||
  pathname.startsWith("/api/collect/") ||
  // 小程序接口：自带 Bearer token 鉴权，不走 web cookie
  pathname.startsWith("/api/miniapp/");

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

export default function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 写入 x-pathname，让 server 组件能感知当前路径（用于全局 TopNav 等）
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  const passThrough = NextResponse.next({ request: { headers: requestHeaders } });

  if (PUBLIC(pathname)) return passThrough;

  const hasSession = SESSION_COOKIE_NAMES.some(
    (n) => !!req.cookies.get(n)?.value,
  );
  if (hasSession) return passThrough;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "请先登录" } },
      { status: 401 },
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // 排除静态资源 / Next 内部
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
