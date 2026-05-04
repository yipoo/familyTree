/**
 * 在 @react-pdf/renderer 中注册 CJK 字体。
 *
 * 默认加载顺序：
 *   1. 环境变量 CJK_FONT_PATH（部署时指定）
 *   2. macOS 内置：/System/Library/Fonts/Hiragino Sans GB.ttc
 *   3. macOS 内置：/System/Library/Fonts/STHeiti Light.ttc
 *   4. 找不到则不注册（Latin 仍可输出，CJK 字符显示为方框）
 *
 * 注册一次后全局生效；fontFamily="CJK" 即可使用。
 */
import fs from "node:fs";
import path from "node:path";

import { Font } from "@react-pdf/renderer";

let registered = false;

const CANDIDATES = [
  process.env.CJK_FONT_PATH,
  "/System/Library/Fonts/Hiragino Sans GB.ttc",
  "/System/Library/Fonts/STHeiti Light.ttc",
  "/System/Library/Fonts/STHeiti Medium.ttc",
  "/System/Library/Fonts/Supplemental/Songti.ttc",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
  // 若打包时附带，可放到 public/fonts/cjk.ttf
  path.resolve(process.cwd(), "public/fonts/cjk.ttf"),
].filter((x): x is string => !!x);

export function ensureCjkFont(): "CJK" | "Helvetica" {
  if (registered) return "CJK";
  for (const p of CANDIDATES) {
    try {
      if (!fs.existsSync(p)) continue;
      Font.register({
        family: "CJK",
        src: p,
      });
      registered = true;
      return "CJK";
    } catch {
      // try next
    }
  }
  console.warn(
    "[pdf] 未找到 CJK 字体，PDF 中的中文将退回 Helvetica（可能显示为方框）。可在环境变量 CJK_FONT_PATH 指定。",
  );
  return "Helvetica";
}
