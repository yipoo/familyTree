/**
 * 极简 Markdown 解析器（纯函数，无第三方依赖）。
 *
 * 册谱正文同时喂给两套渲染器：屏幕/打印（React DOM）与 PDF（@react-pdf/renderer
 * 只认 <Text>/<View>，渲染不了 HTML）。因此不能存任意 HTML、也不引入产出 HTML
 * 字符串的 markdown 库——这里把源码解析成受控的 Block[] 结构，由两端各写一个薄
 * 渲染器消费同一份 token。受控结构天然防 XSS（绝不 dangerouslySetInnerHTML）。
 *
 * 支持的子集：
 *   - 标题：`# / ## / ###`（一到三级）
 *   - 列表：`- ` / `* ` 无序，`1. ` / `1) ` 有序（连续同类项合并为一个列表）
 *   - 段落：空行分段；段内换行保留为软换行（text 内的 "\n"）
 *   - 强调：`**加粗**`（未闭合的 ** 原样保留为文本）
 *
 * 刻意不支持 raw HTML / 链接 / 图片 / 代码块——够用且安全。
 */

export type Inline = { t: "text"; v: string } | { t: "strong"; v: string };

export type Block =
  | { t: "heading"; level: 1 | 2 | 3; inlines: Inline[] }
  | { t: "para"; inlines: Inline[] }
  | { t: "list"; ordered: boolean; items: Inline[][] };

export function parseMarkdown(src: string | null | undefined): Block[] {
  if (!src) return [];
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paraBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length === 0) return;
    const text = paraBuf.join("\n");
    if (text.trim()) blocks.push({ t: "para", inlines: parseInline(text) });
    paraBuf = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 空行 → 段落分隔
    if (!line.trim()) {
      flushPara();
      i++;
      continue;
    }

    // 标题 # / ## / ###
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara();
      blocks.push({
        t: "heading",
        level: h[1].length as 1 | 2 | 3,
        inlines: parseInline(h[2].trim()),
      });
      i++;
      continue;
    }

    // 列表：连续同类（同 ordered）项合并为一个 list 块
    const first = matchListItem(line);
    if (first) {
      flushPara();
      const ordered = first.ordered;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const cur = matchListItem(lines[i]);
        if (!cur || cur.ordered !== ordered) break;
        items.push(parseInline(cur.text));
        i++;
      }
      blocks.push({ t: "list", ordered, items });
      continue;
    }

    // 普通段落文本（多行合并，段内软换行）
    paraBuf.push(line);
    i++;
  }
  flushPara();
  return blocks;
}

/** `- ` / `* ` 无序；`1. ` / `1) ` 有序。注意 `**加粗**` 开头不会误判（* 后须有空白）。 */
function matchListItem(line: string): { ordered: boolean; text: string } | null {
  const u = line.match(/^\s*[-*]\s+(.*)$/);
  if (u) return { ordered: false, text: u[1] };
  const o = line.match(/^\s*\d+[.)]\s+(.*)$/);
  if (o) return { ordered: true, text: o[1] };
  return null;
}

/**
 * 行内解析：把 `**加粗**` 切成 text / strong 段。
 * 未闭合的 ** 不匹配 → 连同字面 ** 作为普通文本保留。
 */
export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let rest = s;
  const re = /\*\*([\s\S]+?)\*\*/;
  let m = rest.match(re);
  while (m && m.index !== undefined) {
    if (m.index > 0) pushText(out, rest.slice(0, m.index));
    pushStrong(out, m[1]);
    rest = rest.slice(m.index + m[0].length);
    m = rest.match(re);
  }
  if (rest) pushText(out, rest);
  return out;
}

function pushText(out: Inline[], v: string) {
  if (v) out.push({ t: "text", v });
}

function pushStrong(out: Inline[], v: string) {
  if (v) out.push({ t: "strong", v });
}
