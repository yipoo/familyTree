/**
 * CJK 逐字断行拆分（纯函数，供 lib/pdf/fonts.ts 注册为 react-pdf 全局
 * hyphenation 回调；独立成模块便于单测，不依赖 @react-pdf/renderer）。
 *
 * 背景：react-pdf 的分词只认 ASCII 空格——中文整段会被当成一个超长"词"，
 * 既不换行也无法两端对齐，整行冲出页面右缘被裁切。把含 CJK 的词拆成
 * 逐字 part 后，textkit 即可在字间断行；行尾不出现 "-" 依赖
 * patches/@react-pdf__textkit 补丁（CJK 断点跳过连字符插入）。
 *
 * 避头尾（简化禁则）：
 *   - 行首禁则标点（，。、；：？！）】》…）并入前一字，不会落到行首；
 *   - 行尾禁则标点（（【《「…）并入后一字，不会孤悬行尾；
 *   - 连续西文/数字段不拆，保持整词换行（如 "demo"、"2026"）。
 */

const CJK_CHAR = /[⺀-鿿豈-﫿︰-﹏＀-￯]/;
const NO_LINE_START = "，。、；：？！）】》〉」』〕％…—·,.;:?!)]}";
const NO_LINE_END = "（【《〈「『〔([{";

/** 把一个"词"拆成可断行的 part 序列；parts.join("") 恒等于原词。 */
export function splitCjkForWrap(word: string): string[] {
  if (!CJK_CHAR.test(word)) return [word];
  const parts: string[] = [];
  const push = (seg: string) => {
    const prev = parts[parts.length - 1];
    if (
      prev &&
      (NO_LINE_START.includes(seg[0]) || NO_LINE_END.includes(prev[prev.length - 1]))
    ) {
      parts[parts.length - 1] = prev + seg;
    } else {
      parts.push(seg);
    }
  };
  let latin = "";
  for (const ch of word) {
    if (CJK_CHAR.test(ch)) {
      if (latin) {
        push(latin);
        latin = "";
      }
      push(ch);
    } else {
      latin += ch;
    }
  }
  if (latin) push(latin);
  return parts;
}
