/**
 * Next.js Route Handler 限流包装。
 *
 * 拆出来是为了让纯算法（lib/rate-limit.ts）能在 vitest 里独立测试，
 * 不被 next-auth / next/server 的运行时依赖污染。
 *
 * 用法：
 *   export const POST = withRateLimit(handler, {
 *     bucket: "login", limit: 10, windowMs: 60_000,
 *   });
 *
 *   export const POST = withRateLimit(handler, {
 *     bucket: "import-xlsx", limit: 5, windowMs: 60_000, withUser: true,
 *   });
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { check, ipOf, type RateLimitOptions } from "@/lib/rate-limit";

export interface WithRateLimitOptions extends RateLimitOptions {
  /** 是否额外加 user-id 键（双键限流） */
  withUser?: boolean;
}

export type RouteHandler<Ctx> = (
  req: Request,
  ctx: Ctx,
) => Promise<Response> | Response;

export function withRateLimit<Ctx>(
  handler: RouteHandler<Ctx>,
  opts: WithRateLimitOptions,
): RouteHandler<Ctx> {
  return async (req, ctx) => {
    const keys: string[] = [`ip:${ipOf(req)}`];
    if (opts.withUser) {
      try {
        const session = await auth();
        const uid = session?.user?.id;
        if (uid) keys.push(`user:${uid}`);
      } catch {
        // 取会话失败不影响限流
      }
    }
    const r = check(keys, opts);
    if (!r.ok) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "请求过于频繁，请稍后再试",
            retryAfterSec: r.retryAfterSec,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(r.retryAfterSec),
            "X-RateLimit-Bucket": opts.bucket,
          },
        },
      );
    }
    return handler(req, ctx);
  };
}
