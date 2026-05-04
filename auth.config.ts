/**
 * 边缘运行时安全的最小 Auth.js 配置（proxy.ts / middleware 共用）。
 *
 * 这里 **不能** 引用 Prisma / Node-only 模块。
 * Credentials provider 留空：实际验证逻辑写在 `auth.ts` 里，避免 middleware 把 Prisma
 * 拖进 edge runtime。JWT 由两边共用 secret 即可读出来。
 */
import type { NextAuthConfig } from "next-auth";

export default {
  // 本地开发或非 Vercel 反向代理环境下需要显式 trust host，否则 Credentials POST 会触发
  // MissingCSRF（CSRF 双重检查依赖正确的 host header）
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    // 真正的路由守卫由 proxy.ts 处理（为了保留 ?next 回跳参数）
    authorized: () => true,
  },
} satisfies NextAuthConfig;
