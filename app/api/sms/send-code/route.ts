/**
 * 发送短信验证码（公开接口，proxy.ts 已加白名单）。
 *
 * Body: { phone, purpose? }  purpose 默认 LOGIN
 * 200 { data: { cooldownSec } }
 * 4xx { error: { code, message, cooldownSec? } }
 */
import { NextResponse } from "next/server";

import { normalizePhone } from "@/lib/auth/password";
import { issueCode } from "@/lib/services/verification";
import type { VerificationPurpose } from "@/lib/generated/prisma/enums";

const VALID_PURPOSES: VerificationPurpose[] = [
  "LOGIN",
  "REGISTER",
  "CHANGE_PHONE",
];

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const phoneRaw = String(body?.phone ?? "").trim();
  const purposeRaw = String(body?.purpose ?? "LOGIN");

  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return NextResponse.json(
      { error: { code: "INVALID_PHONE", message: "手机号格式不正确" } },
      { status: 400 },
    );
  }
  if (!VALID_PURPOSES.includes(purposeRaw as VerificationPurpose)) {
    return NextResponse.json(
      { error: { code: "INVALID_PURPOSE", message: "用途不合法" } },
      { status: 400 },
    );
  }

  const r = await issueCode(phone, purposeRaw as VerificationPurpose);
  if (!r.ok) {
    return NextResponse.json(
      {
        error: {
          code: r.code,
          message: r.message,
          ...("cooldownSec" in r ? { cooldownSec: r.cooldownSec } : {}),
        },
      },
      { status: r.code === "COOLDOWN" ? 429 : 503 },
    );
  }
  return NextResponse.json({ data: { cooldownSec: r.cooldownSec } });
}
