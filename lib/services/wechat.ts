/**
 * 微信小程序服务端接口封装。
 *
 * Env：WX_APPID / WX_SECRET（小程序注册后获得）。未配置时抛 WechatNotConfiguredError。
 *   - jscode2session：wx.login() 的 code → openid / unionid / session_key
 *   - getPhoneNumber：getPhoneNumber 按钮的 code → 真实手机号（需 access_token）
 *
 * 拿到 AppID/Secret 前，调用方可走 mock 分支（见路由 dev 兜底）。
 */
const BASE = "https://api.weixin.qq.com";

export class WechatNotConfiguredError extends Error {
  code = "WX_NOT_CONFIGURED";
  constructor() {
    super("微信小程序未配置（缺少 WX_APPID / WX_SECRET）");
  }
}
export class WechatError extends Error {
  constructor(public errcode: number, msg: string) {
    super(`微信接口错误 ${errcode}: ${msg}`);
  }
}

export function wechatConfigured(): boolean {
  return Boolean(process.env.WX_APPID && process.env.WX_SECRET);
}

function creds() {
  const appid = process.env.WX_APPID;
  const secret = process.env.WX_SECRET;
  if (!appid || !secret) throw new WechatNotConfiguredError();
  return { appid, secret };
}

export interface SessionResult {
  openid: string;
  unionid?: string;
  sessionKey: string;
}

export async function jscode2session(code: string): Promise<SessionResult> {
  const { appid, secret } = creds();
  const url = `${BASE}/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  const res = await fetch(url);
  const d = await res.json();
  if (d.errcode) throw new WechatError(d.errcode, d.errmsg ?? "jscode2session 失败");
  return { openid: d.openid, unionid: d.unionid, sessionKey: d.session_key };
}

// access_token 进程内缓存（微信 2h 有效，提前 5 分钟刷新）
let _token: { value: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (_token && _token.exp > Date.now()) return _token.value;
  const { appid, secret } = creds();
  const res = await fetch(
    `${BASE}/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`,
  );
  const d = await res.json();
  if (!d.access_token) throw new WechatError(d.errcode ?? -1, d.errmsg ?? "获取 access_token 失败");
  _token = { value: d.access_token, exp: Date.now() + ((d.expires_in ?? 7200) - 300) * 1000 };
  return d.access_token;
}

export async function getPhoneNumber(phoneCode: string): Promise<string> {
  creds(); // 确保已配置
  const token = await getAccessToken();
  const res = await fetch(`${BASE}/wxa/business/getuserphonenumber?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: phoneCode }),
  });
  const d = await res.json();
  if (d.errcode !== 0) throw new WechatError(d.errcode ?? -1, d.errmsg ?? "获取手机号失败");
  const info = d.phone_info ?? {};
  return info.purePhoneNumber || info.phoneNumber;
}
