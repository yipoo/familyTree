/**
 * 小程序登录（第一步）
 *
 *   POST { code }            wx.login() 的 code
 *   → 已绑 openid 的老用户：{ token, needPhone:false, positions }
 *   → 新用户：{ needPhone:true, bindToken }（下一步授权手机号）
 *
 * dev 兜底：未配置 WX_* 且非生产时，可传 { devOpenid } 跳过微信换取 openid（便于联调）。
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { jscode2session, wechatConfigured } from "@/lib/services/wechat";
import { signToken } from "@/lib/services/miniapp-token";
import { resolveMyPositions } from "@/lib/auth/miniapp";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let openid: string | null = null;
    let unionid: string | undefined;

    if (wechatConfigured() && body?.code) {
      const s = await jscode2session(String(body.code));
      openid = s.openid;
      unionid = s.unionid;
    } else if (process.env.NODE_ENV !== "production" && body?.devOpenid) {
      openid = String(body.devOpenid); // 联调兜底
    }

    if (!openid) {
      return NextResponse.json(
        { error: { code: "NO_OPENID", message: "无法获取 openid（检查 WX 配置或 code）" } },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { wechatOpenId: openid },
      select: { id: true, name: true },
    });

    if (user) {
      const token = signToken({ openid, userId: user.id, kind: "session" }, 30 * 86400);
      const positions = await resolveMyPositions(user.id);
      return NextResponse.json({
        data: { token, needPhone: false, user: { id: user.id, name: user.name }, positions },
      });
    }

    // 新用户：发短时 bind token，引导授权手机号
    void unionid;
    const bindToken = signToken({ openid, kind: "bind" }, 600);
    return NextResponse.json({ data: { needPhone: true, bindToken } });
  } catch (e) {
    return NextResponse.json(
      { error: { code: "LOGIN_FAILED", message: e instanceof Error ? e.message : "登录失败" } },
      { status: 500 },
    );
  }
}
