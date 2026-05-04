/**
 * API 路由共享：Zod 校验失败 → 400 / 通用错误处理。
 *
 * 用法：
 *   const parsed = schema.safeParse(json);
 *   if (!parsed.success) return zodError(parsed.error);
 *
 * authErrorResponse(e) 已经处理 401/403；其它错误统一 500。
 */
import { NextResponse } from "next/server";
import type { ZodError } from "zod";

import { authErrorResponse, AuthError } from "@/lib/auth/guard";

export function zodError(err: ZodError): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "VALIDATION_FAILED",
        message: err.issues[0]?.message ?? "请求参数不合法",
        issues: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    },
    { status: 400 },
  );
}

export function notFound(message = "未找到"): NextResponse {
  return NextResponse.json(
    { error: { code: "NOT_FOUND", message } },
    { status: 404 },
  );
}

export function badRequest(code: string, message: string): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status: 400 },
  );
}

export function conflict(code: string, message: string): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status: 409 },
  );
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof AuthError) return authErrorResponse(err);
  console.error("[api]", err);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL",
        message: err instanceof Error ? err.message : "服务异常",
      },
    },
    { status: 500 },
  );
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
