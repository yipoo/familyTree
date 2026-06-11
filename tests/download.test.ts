import { describe, expect, it } from "vitest";

import { attachmentDisposition } from "@/lib/api/download";

/** HTTP 头是 ByteString（Latin-1）：每个字符码位必须 ≤ 255，否则 Node 设头会抛错。 */
function isLatin1Safe(s: string): boolean {
  for (const ch of s) if (ch.codePointAt(0)! > 255) return false;
  return true;
}

describe("attachmentDisposition", () => {
  it("纯 ASCII 文件名：filename 原样 + filename* 同值", () => {
    const v = attachmentDisposition("album.pdf");
    expect(v).toBe("attachment; filename=\"album.pdf\"; filename*=UTF-8''album.pdf");
    expect(isLatin1Safe(v)).toBe(true);
  });

  it("中文文件名：整个头值仍是 Latin-1 安全（核心 bug 修复）", () => {
    const v = attachmentDisposition("丁氏家族-册谱.pdf");
    expect(isLatin1Safe(v)).toBe(true); // 不会再抛 ByteString 错误
    // ASCII 兜底：中文替换为下划线
    expect(v).toContain('filename="');
    expect(/filename="[\x20-\x7E]*"/.test(v)).toBe(true);
    // filename* 为 UTF-8 百分号编码，能还原中文
    expect(v).toContain("filename*=UTF-8''");
    const enc = v.split("filename*=UTF-8''")[1];
    expect(decodeURIComponent(enc)).toBe("丁氏家族-册谱.pdf");
  });

  it("含引号/反斜杠/分号被兜底替换，不破坏头结构", () => {
    const v = attachmentDisposition('a"b\\c;d.pdf');
    expect(/filename="[^"\\;]*"/.test(v)).toBe(true);
    expect(isLatin1Safe(v)).toBe(true);
  });

  it("全非 ASCII → 兜底为下划线占位；空 → download", () => {
    expect(attachmentDisposition("册谱")).toContain('filename="__"'); // 两字两下划线
    expect(isLatin1Safe(attachmentDisposition("册谱"))).toBe(true);
    expect(attachmentDisposition("")).toContain('filename="download"');
  });
});
