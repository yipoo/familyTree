# PDF 中文字体

`cjk.otf` = **Noto Serif CJK SC (Regular)**，用于册谱 PDF（@react-pdf）的中文渲染。

- 许可：SIL Open Font License 1.1（可自由打包/分发）
- 来源：https://github.com/notofonts/noto-cjk
- 为什么放在仓库：react-pdf 不支持系统常见的 `.ttc` 字体集合（会抛
  "Font collection is not supported"），故自带一个 `.ttf/.otf` 保证任何环境开箱即用。
- 加载顺序见 `lib/pdf/fonts.ts`：`CJK_FONT_PATH` 环境变量 > `public/fonts/cjk.otf`。
- 若要册谱封面竖排题名用真正的毛笔/楷体，另放一个 `public/fonts/brush.ttf`（楷体/行楷）
  或设 `CJK_BRUSH_FONT_PATH`；缺省回退到本字体。
