/**
 * 短信验证码：发码 / 验码 / 防滥用。
 *
 * 策略：
 *   - 6 位数字
 *   - 5 分钟有效
 *   - 同手机号同用途冷却 60 秒（两次发码间隔）
 *   - 发新码时把旧的未消费记录 expiresAt 设为 now（一次只活一个）
 *   - 验证 5 次失败即作废
 *   - 通过即标记 consumedAt（一码一用）
 */
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { sendLoginCode } from "@/lib/services/sms";
import type { VerificationPurpose } from "@/lib/generated/prisma/enums";

const CODE_LEN = 6;
const TTL_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export type IssueResult =
  | { ok: true; cooldownSec: number }
  | { ok: false; code: "COOLDOWN" | "INVALID_PHONE" | "SMS_FAILED"; message: string; cooldownSec?: number };

export type VerifyResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "NO_CODE"
        | "EXPIRED"
        | "ATTEMPTS_EXCEEDED"
        | "MISMATCH"
        | "CONSUMED";
      message: string;
    };

function genCode(): string {
  // crypto-grade 6 digit code
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % 1000000).toString().padStart(CODE_LEN, "0");
}

/**
 * 发码：检查冷却 → 生成 → 让旧码失效 → 发短信。
 * SMS 失败时回滚（删除刚插的记录）以免占用冷却。
 */
export async function issueCode(
  phone: string,
  purpose: VerificationPurpose,
): Promise<IssueResult> {
  // 检查冷却：取最新一条
  const last = await prisma.verificationCode.findFirst({
    where: { phone, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last) {
    const elapsed = Date.now() - last.createdAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      const remain = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return {
        ok: false,
        code: "COOLDOWN",
        message: `请 ${remain} 秒后再试`,
        cooldownSec: remain,
      };
    }
  }

  const code = genCode();
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + TTL_MS);

  // 让该手机号-用途的所有未消费、未过期的旧码失效
  await prisma.verificationCode.updateMany({
    where: {
      phone,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { expiresAt: new Date() },
  });

  const created = await prisma.verificationCode.create({
    data: { phone, purpose, codeHash, expiresAt },
    select: { id: true },
  });

  const sms = await sendLoginCode(phone, code);
  if (!sms.ok) {
    // 短信失败：删除刚插的记录，避免占用冷却
    await prisma.verificationCode.delete({ where: { id: created.id } });
    return {
      ok: false,
      code: "SMS_FAILED",
      message: sms.message,
    };
  }

  return { ok: true, cooldownSec: COOLDOWN_MS / 1000 };
}

/**
 * 校验最新一条尚未消费且未过期的记录。
 * 命中：consumedAt = now，返回 ok。
 * 不命中：attempts++，超阈值则作废。
 */
export async function verifyCode(
  phone: string,
  purpose: VerificationPurpose,
  inputCode: string,
): Promise<VerifyResult> {
  const rec = await prisma.verificationCode.findFirst({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!rec) {
    return { ok: false, code: "NO_CODE", message: "请先获取验证码" };
  }
  if (rec.expiresAt.getTime() < Date.now()) {
    return { ok: false, code: "EXPIRED", message: "验证码已过期，请重新获取" };
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    return {
      ok: false,
      code: "ATTEMPTS_EXCEEDED",
      message: "尝试次数过多，请重新获取",
    };
  }

  const ok = await bcrypt.compare(inputCode.trim(), rec.codeHash);
  if (!ok) {
    const remaining = MAX_ATTEMPTS - rec.attempts - 1;
    await prisma.verificationCode.update({
      where: { id: rec.id },
      data: {
        attempts: { increment: 1 },
        // 用完即作废
        ...(remaining <= 0 ? { expiresAt: new Date() } : {}),
      },
    });
    return {
      ok: false,
      code: "MISMATCH",
      message:
        remaining <= 0
          ? "验证码错误，已作废，请重新获取"
          : `验证码错误，剩余 ${remaining} 次机会`,
    };
  }

  await prisma.verificationCode.update({
    where: { id: rec.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}
