/**
 * 生成安全的 Content-Disposition 头值。
 *
 * HTTP 头是 ByteString（仅 Latin-1，0–255），直接把含中文的文件名放进
 * `filename="..."` 会抛 "Cannot convert argument to a ByteString..."。
 * 这里按 RFC 6266 / RFC 5987：ASCII 兜底 `filename` + UTF-8 百分号编码的 `filename*`，
 * 整个头值都是 ASCII，安全；现代浏览器优先用 `filename*` 还原中文名。
 */
export function attachmentDisposition(filename: string): string {
  const fallback =
    filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\;]/g, "_").trim() ||
    "download";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(
    filename,
  )}`;
}
