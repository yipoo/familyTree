/**
 * 分享链接（ShareLink）解析。
 *
 * scope 设计（Json）：
 *   { kind: "all" }                    — 整族
 *   { kind: "subtree", rootPersonId }  — 仅某子树（一期不强制；展示阶段先不过滤）
 *
 * 当前一期：scope 仅记录，不影响读出来的数据范围；后续接树视图过滤再用。
 */
import { prisma } from "@/lib/db";

export type ShareScope =
  | { kind: "all" }
  | { kind: "subtree"; rootPersonId: string };

export type LoadedShare = {
  id: string;
  familyId: string;
  token: string;
  scope: ShareScope;
  expired: boolean;
  hasPassword: boolean;
};

export async function loadShareLink(token: string): Promise<LoadedShare | null> {
  if (!token || token.length < 6) return null;
  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link) return null;
  const expired = !!link.expiresAt && link.expiresAt.getTime() < Date.now();
  return {
    id: link.id,
    familyId: link.familyId,
    token: link.token,
    scope: parseScope(link.scope),
    expired,
    hasPassword: !!link.passwordHash,
  };
}

function parseScope(raw: unknown): ShareScope {
  if (raw && typeof raw === "object") {
    const r = raw as { kind?: unknown; rootPersonId?: unknown };
    if (r.kind === "subtree" && typeof r.rootPersonId === "string") {
      return { kind: "subtree", rootPersonId: r.rootPersonId };
    }
  }
  return { kind: "all" };
}

/**
 * 生成 ShareLink.token：32 字符 base64url，不含 padding。
 * 用 crypto.getRandomValues 即可（Node 18+ / edge 都支持）。
 */
export function generateShareToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}
