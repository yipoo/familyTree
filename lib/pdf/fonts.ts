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

import { splitCjkForWrap } from "@/lib/pdf/cjk-wrap";

// CJK 逐字断行：react-pdf 只按 ASCII 空格分词，中文整段会被当成一个超长"词"
// 溢出页缘且无法换行。注册全局回调逐字拆分（含避头尾，见 lib/pdf/cjk-wrap.ts）；
// 行尾不插 "-" 由 patches/@react-pdf__textkit 补丁保证。
Font.registerHyphenationCallback(splitCjkForWrap);

let registered = false;

/**
 * 候选 CJK 字体路径。
 * ⚠️ react-pdf 的 font 库**不支持 .ttc（TrueType Collection）**，加载会抛
 * "Font collection is not supported"。macOS 自带中文字体（Hiragino/STHeiti/Songti）
 * 多为 .ttc，故这里**不列 .ttc**——只用 .ttf/.otf；任何 .ttc（含 CJK_FONT_PATH 误指）
 * 在注册前都会被跳过，避免运行期崩溃。
 *
 * 部署/本地要让 PDF 正确显示中文：放一个 .ttf/.otf 到 public/fonts/cjk.otf（或 .ttf），
 * 或设环境变量 CJK_FONT_PATH 指向 .ttf/.otf。
 */
const CANDIDATES = [
  process.env.CJK_FONT_PATH,
  path.resolve(process.cwd(), "public/fonts/cjk.otf"),
  path.resolve(process.cwd(), "public/fonts/cjk.ttf"),
  // 常见 Linux 发行版的 .otf（非 .ttc）位置
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf",
  "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.otf",
  "/usr/share/fonts/truetype/arphic/uming.ttc", // 占位，会被 .ttc 过滤
].filter((x): x is string => !!x);

/** react-pdf 不支持 .ttc 字体集合，注册前一律跳过。 */
function isLoadableFont(p: string): boolean {
  return !p.toLowerCase().endsWith(".ttc");
}

export function ensureCjkFont(): "CJK" | "Helvetica" {
  if (registered) return "CJK";
  for (const p of CANDIDATES) {
    try {
      if (!fs.existsSync(p)) continue;
      if (!isLoadableFont(p)) {
        console.warn(`[pdf] 跳过 .ttc 字体（react-pdf 不支持字体集合）：${p}`);
        continue;
      }
      Font.register({ family: "CJK", src: p });
      registered = true;
      return "CJK";
    } catch {
      // try next
    }
  }
  console.warn(
    "[pdf] 未找到可用的 CJK .ttf/.otf 字体，PDF 中文将显示为方框（不再崩溃）。" +
      "请放置 public/fonts/cjk.otf 或设环境变量 CJK_FONT_PATH 指向 .ttf/.otf。",
  );
  return "Helvetica";
}

let brushFamily: string | null = null;

const BRUSH_CANDIDATES = [
  process.env.CJK_BRUSH_FONT_PATH,
  // 系统楷体（部署时优先用 CJK_BRUSH_FONT_PATH 指定一个 .ttf/.otf 楷体/行楷）
  "/System/Library/Fonts/Supplemental/Kaiti.ttc", // 注意 .ttc 不被支持，仅占位
  path.resolve(process.cwd(), "public/fonts/brush.ttf"),
  path.resolve(process.cwd(), "public/fonts/kaiti.ttf"),
].filter((x): x is string => !!x);

/**
 * 册谱封面竖排题名用的"毛笔/楷体"字体。
 * 部署时把一个 .ttf/.otf 楷体放到 public/fonts/brush.ttf 或用 CJK_BRUSH_FONT_PATH 指定。
 * 找不到专用毛笔字体时回退到常规 CJK 字体（竖排仍生效，只是非毛笔风）。
 */
export function ensureBrushFont(): string {
  if (brushFamily) return brushFamily;
  for (const p of BRUSH_CANDIDATES) {
    try {
      if (!fs.existsSync(p)) continue;
      if (p.toLowerCase().endsWith(".ttc")) continue; // react-pdf 不支持字体集合
      Font.register({ family: "CJKBrush", src: p });
      brushFamily = "CJKBrush";
      return brushFamily;
    } catch {
      // try next
    }
  }
  brushFamily = ensureCjkFont(); // 回退常规 CJK
  return brushFamily;
}
