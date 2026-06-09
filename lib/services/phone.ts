/**
 * 手机号规范化 + 哈希（小程序"纯自动匹配"身份定位用）。
 *
 * 库里只存 sha256(规范化手机号)，不存明文，保护族人隐私。
 * 登录拿到手机号后同法哈希，与 Person.contactPhoneHash 比对即定位节点。
 */
import { createHash } from "node:crypto";

/** 去除分隔符 / 国家码，得到纯数字手机号。 */
export function normalizePhone(raw: string): string {
  let d = (raw ?? "").replace(/\D/g, "");
  // +86 / 86 前缀
  if (d.length === 13 && d.startsWith("86")) d = d.slice(2);
  // 误带前导 0（如 086 / 0+11位）
  if (d.length === 12 && d.startsWith("0")) d = d.slice(1);
  return d;
}

/** 是否中国大陆手机号（1 开头 11 位）。 */
export function isValidCnMobile(raw: string): boolean {
  return /^1[3-9]\d{9}$/.test(normalizePhone(raw));
}

/** 规范化后哈希；太短（不可信）返回 null，避免空值误匹配。 */
export function hashPhone(raw: string): string | null {
  const n = normalizePhone(raw);
  if (n.length < 6) return null;
  return createHash("sha256").update(n).digest("hex");
}
