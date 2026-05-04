/**
 * 客户端可安全导入的邀请码格式化工具（不依赖 Prisma / Node 模块）。
 * lib/services/invites.ts 的服务端逻辑会从这里 re-export 同名函数，
 * 客户端组件只需 import 这个文件即可。
 */

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 字符
const CODE_LEN = 8;

export function generateInviteCode(): string {
  const arr = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[arr[i] % CODE_ALPHABET.length];
  }
  return out;
}

export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function formatInviteCode(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}
