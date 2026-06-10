# PDF 中文字体（册谱 @react-pdf 用）

react-pdf 的 font 库**不支持系统常见的 `.ttc` 字体集合**（会抛 "Font collection is
not supported"），故仓库自带 `.ttf/.otf`，保证 PDF 任何环境开箱即用、零配置。
加载逻辑见 `lib/pdf/fonts.ts`。

| 文件 | 字体 | 用途 | 许可 |
|---|---|---|---|
| `cjk.otf` | Noto Serif CJK SC (Regular) | 正文/通用中文（衬线、刻本风） | SIL OFL 1.1 |
| `brush.ttf` | 霞鹜文楷 LXGW WenKai (Regular) | 合编本封面竖排题名（楷体/毛笔风） | SIL OFL 1.1 |

来源：
- Noto CJK：https://github.com/notofonts/noto-cjk
- LXGW WenKai：https://github.com/lxgw/LxgwWenKai （v1.522；注意 **Medium 字重会让
  react-pdf 渲染硬崩溃，必须用 Regular**）

加载顺序：
- 正文：`CJK_FONT_PATH` 环境变量（.ttf/.otf）> `public/fonts/cjk.otf`
- 封面题名：`CJK_BRUSH_FONT_PATH` > `public/fonts/brush.ttf`，缺省回退正文字体（见 `ensureBrushFont`）

屏幕/打印（HTML）端封面用 CSS `--font-brush`（系统楷体栈，见 `app/globals.css`），
不加载这里的 24MB 字体以免拖慢网页。
