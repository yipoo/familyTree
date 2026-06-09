/**
 * 小程序绑定手机号（第二步）→ 以手机号为唯一身份自动定位族谱位置
 *
 *   POST { bindToken, phoneCode }
 *   → upsert User by phone、绑定 openid、自动匹配节点
 *   → { token, user, positions }
 *
 * dev 兜底：未配置 WX_* 且非生产时，可传 { devPhone } 跳过微信换取手机号。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getPhoneNumber, wechatConfigured } from "@/lib/services/wechat";
import { signToken, verifyToken } from "@/lib/services/miniapp-token";
import { isValidCnMobile, normalizePhone } from "@/lib/services/phone";
import { resolveMyPositions } from "@/lib/auth/miniapp";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const claims = body?.bindToken ? verifyToken(String(body.bindToken)) : null;
    if (!claims || claims.kind !== "bind") {
      return NextResponse.json(
        { error: { code: "BAD_BIND_TOKEN", message: "绑定凭证无效或已过期，请重新进入" } },
        { status: 401 },
      );
    }
    const openid = claims.openid;

    let phone: string | null = null;
    if (wechatConfigured() && body?.phoneCode) {
      phone = await getPhoneNumber(String(body.phoneCode));
    } else if (process.env.NODE_ENV !== "production" && body?.devPhone) {
      phone = String(body.devPhone);
    }

    if (!phone || !isValidCnMobile(phone)) {
      return NextResponse.json(
        { error: { code: "BAD_PHONE", message: "未获取到有效手机号" } },
        { status: 400 },
      );
    }
    const normalized = normalizePhone(phone);

    // 以手机号为唯一键 upsert，并绑定 openid
    const existing = await prisma.user.findUnique({
      where: { phone: normalized },
      select: { id: true, name: true, wechatOpenId: true },
    });

    let userId: string;
    let name: string;
    if (existing) {
      if (existing.wechatOpenId && existing.wechatOpenId !== openid) {
        // 该手机号已绑别的微信——安全起见拒绝（避免顶号）
        return NextResponse.json(
          { error: { code: "PHONE_BOUND_ELSEWHERE", message: "该手机号已绑定其他微信" } },
          { status: 409 },
        );
      }
      if (!existing.wechatOpenId) {
        await prisma.user.update({ where: { id: existing.id }, data: { wechatOpenId: openid } });
      }
      userId = existing.id;
      name = existing.name;
    } else {
      const created = await prisma.user.create({
        data: { phone: normalized, name: `族人${normalized.slice(-4)}`, wechatOpenId: openid },
        select: { id: true, name: true },
      });
      userId = created.id;
      name = created.name;
    }

    const token = signToken({ openid, userId, kind: "session" }, 30 * 86400);
    const positions = await resolveMyPositions(userId);
    return NextResponse.json({ data: { token, user: { id: userId, name }, positions } });
  } catch (e) {
    return NextResponse.json(
      { error: { code: "BIND_FAILED", message: e instanceof Error ? e.message : "绑定失败" } },
      { status: 500 },
    );
  }
}
