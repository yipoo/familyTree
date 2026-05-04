/**
 * 短信服务（阿里云 dysmsapi）。
 *
 * 必需环境变量：
 *   ALIYUN_SMS_ACCESS_KEY_ID
 *   ALIYUN_SMS_ACCESS_KEY_SECRET
 *   ALIYUN_SMS_SIGN_NAME
 *   ALIYUN_SMS_TEMPLATE_LOGIN
 *
 * 行为：
 *   - 全部环境变量配齐 → 走真实发送
 *   - 缺任一 + NODE_ENV=development → 控制台打印验证码（仍能完成登录联调）
 *   - 缺任一 + NODE_ENV=production → 抛错，让上层返回 503
 */

export type SmsResult =
  | { ok: true; method: "aliyun" | "dev_console" }
  | { ok: false; code: string; message: string };

interface SmsConfig {
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
  endpoint: string;
}

function readConfig(): SmsConfig | null {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_LOGIN;
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) return null;
  return {
    accessKeyId,
    accessKeySecret,
    signName,
    templateCode,
    endpoint: process.env.ALIYUN_SMS_ENDPOINT ?? "dysmsapi.aliyuncs.com",
  };
}

/**
 * 发送登录验证码短信。
 *
 * 模板假定形如「验证码 ${code}，5 分钟内有效。如非本人操作请忽略。」
 * 模板变量名约定为 `code`。如阿里云模板用其他变量名，请改下面 templateParam。
 */
export async function sendLoginCode(
  phone: string,
  code: string,
): Promise<SmsResult> {
  const cfg = readConfig();

  if (!cfg) {
    if (process.env.NODE_ENV !== "production") {
      // dev fallback：打印到控制台，登录联调用
      console.log(
        `[DEV SMS] ${phone} → ${code}  (configure ALIYUN_SMS_* env vars to send real SMS)`,
      );
      return { ok: true, method: "dev_console" };
    }
    return {
      ok: false,
      code: "SMS_NOT_CONFIGURED",
      message: "短信服务未配置",
    };
  }

  try {
    const [dysmod, openapi, teautil] = await Promise.all([
      import("@alicloud/dysmsapi20170525"),
      import("@alicloud/openapi-client"),
      import("@alicloud/tea-util"),
    ]);

    const Client = dysmod.default;
    const SendSmsRequest = dysmod.SendSmsRequest;
    const Config = openapi.Config;
    const RuntimeOptions = teautil.RuntimeOptions;

    const config = new Config({
      accessKeyId: cfg.accessKeyId,
      accessKeySecret: cfg.accessKeySecret,
    });
    config.endpoint = cfg.endpoint;

    const client = new Client(config);
    const req = new SendSmsRequest({
      phoneNumbers: phone,
      signName: cfg.signName,
      templateCode: cfg.templateCode,
      templateParam: JSON.stringify({ code }),
    });
    const runtime = new RuntimeOptions({});
    const res = await client.sendSmsWithOptions(req, runtime);
    const body = res.body;
    if (body?.code !== "OK") {
      return {
        ok: false,
        code: body?.code ?? "UNKNOWN",
        message: body?.message ?? "短信发送失败",
      };
    }
    return { ok: true, method: "aliyun" };
  } catch (e) {
    return {
      ok: false,
      code: "SDK_ERROR",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
