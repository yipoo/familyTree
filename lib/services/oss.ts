/**
 * 阿里云 OSS 封装（媒体/影像层）
 *
 * 用途：人物相册 / 老谱扫描件 / 家族影像直传——文件落 OSS，库里只存 URL + 元数据。
 *
 * Env（仅服务端）：
 *   OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET / OSS_REGION
 *   OSS_PUBLIC_DOMAIN   可选 CDN 域名
 *
 * 未配置时 ossConfigured()=false，上传 API / UI 应直接拒绝并提示。
 * 改编自 zhaoshang-dashboard/src/lib/oss.ts，按家谱场景扩展媒体类型 + 家族目录约定。
 */
import OSS from "ali-oss";

import type { MediaKind } from "@/lib/generated/prisma/enums";

let _client: OSS | null = null;

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`OSS env not set: ${name}`);
  return v;
}

function getClient(): OSS {
  if (_client) return _client;
  _client = new OSS({
    accessKeyId: envOrThrow("OSS_ACCESS_KEY_ID"),
    accessKeySecret: envOrThrow("OSS_ACCESS_KEY_SECRET"),
    bucket: envOrThrow("OSS_BUCKET"),
    region: envOrThrow("OSS_REGION"),
    secure: true,
  });
  return _client;
}

/** 拼公网 URL：优先 CDN，否则 OSS 默认域名 */
function publicUrl(objectKey: string): string {
  const cdn = process.env.OSS_PUBLIC_DOMAIN?.replace(/\/+$/, "");
  const cleanKey = objectKey.split(/[?#]/)[0];
  if (cdn) return `${cdn}/${cleanKey}`;
  const bucket = envOrThrow("OSS_BUCKET");
  const region = envOrThrow("OSS_REGION");
  return `https://${bucket}.${region}.aliyuncs.com/${cleanKey}`;
}

/** 去签名/query 的纯净 URL，写库前过一遍 */
export function stripUrlQuery(url: string): string {
  if (!url) return url;
  const i = url.search(/[?#]/);
  return i === -1 ? url : url.slice(0, i);
}

/** OSS env 是否配齐（UI / API 用来决定是否允许上传） */
export function ossConfigured(): boolean {
  return Boolean(
    process.env.OSS_ACCESS_KEY_ID &&
      process.env.OSS_ACCESS_KEY_SECRET &&
      process.env.OSS_BUCKET &&
      process.env.OSS_REGION,
  );
}

/**
 * 若 url 是我们自己 bucket 的对象，给它加临时签名（默认 24h）；
 * 私有读 bucket 时浏览器能访问，公共读时签名被忽略。外部 URL 原样返回。
 */
export function ossSignIfOurs(url: string | null | undefined, expiresSec = 24 * 3600): string {
  if (!url) return url ?? "";
  if (!ossConfigured()) return url;
  try {
    const u = new URL(url);
    const bucket = process.env.OSS_BUCKET!;
    const region = process.env.OSS_REGION!;
    const cdn = process.env.OSS_PUBLIC_DOMAIN?.replace(/\/+$/, "");
    const stdHost = `${bucket}.${region}.aliyuncs.com`;
    let isOurs = u.hostname === stdHost;
    if (!isOurs && cdn) {
      try {
        isOurs = u.hostname === new URL(cdn).hostname;
      } catch {
        /* ignore */
      }
    }
    if (!isOurs) return url;
    const objectKey = u.pathname.replace(/^\/+/, "");
    if (!objectKey) return url;
    return getClient().signatureUrl(objectKey, { expires: expiresSec });
  } catch {
    return url;
  }
}

/** 上传 Buffer 到 OSS，返回纯净公网 URL */
export async function uploadBuffer(
  objectKey: string,
  buf: Buffer,
  mime = "application/octet-stream",
): Promise<string> {
  const client = getClient();
  const filename = objectKey.split("/").pop() || "file";
  await client.put(objectKey, buf, {
    mime,
    headers: {
      "Cache-Control": "public, max-age=31536000",
      // 显式 inline，让 <img>/新标签页能预览而非强制下载
      "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
  return stripUrlQuery(publicUrl(objectKey));
}

/** 删除 OSS 对象（失败吞掉，不阻塞业务——库里删了即可） */
export async function deleteObject(objectKey: string): Promise<void> {
  try {
    await getClient().delete(objectKey);
  } catch (e) {
    console.warn("[oss] delete failed", objectKey, e);
  }
}

// ── 媒体类型白名单 + 工具 ──────────────────────────────────────────────

export const SUPPORTED_MEDIA_MIME: Record<string, { ext: string; kind: MediaKind }> = {
  "image/jpeg": { ext: "jpg", kind: "PHOTO" },
  "image/png": { ext: "png", kind: "PHOTO" },
  "image/webp": { ext: "webp", kind: "PHOTO" },
  "image/avif": { ext: "avif", kind: "PHOTO" },
  "image/gif": { ext: "gif", kind: "PHOTO" },
  "application/pdf": { ext: "pdf", kind: "DOCUMENT" },
  "audio/mpeg": { ext: "mp3", kind: "AUDIO" },
  "audio/mp4": { ext: "m4a", kind: "AUDIO" },
  "audio/x-m4a": { ext: "m4a", kind: "AUDIO" },
  "audio/wav": { ext: "wav", kind: "AUDIO" },
  "video/mp4": { ext: "mp4", kind: "VIDEO" },
  "video/quicktime": { ext: "mov", kind: "VIDEO" },
};

export function mediaInfoFromMime(mime: string): { ext: string; kind: MediaKind } | null {
  return SUPPORTED_MEDIA_MIME[mime.toLowerCase()] ?? null;
}

/** 对象路径约定：familytree/{familyId}/{YYYYMMDD}/{rand}.{ext} */
export function buildMediaKey(familyId: string, ext: string): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
  const rand = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `familytree/${familyId}/${ymd}/${rand}.${ext}`;
}
