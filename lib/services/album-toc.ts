/**
 * 册谱目录页码计算（纯函数，可单测）。
 *
 * 1-based 页码：封面占 coverPages 页、目录占 tocPages 页，首章内容页 = 之后第一页。
 * tocPages 作为参数 → 目录本身溢出多页时只需传更大值，不再写死 tocStartPage=3。
 */
export interface TocSection {
  title: string;
  /** 该章节占的页数 */
  count: number;
}

export interface TocResult {
  entries: { title: string; page: number }[];
  /** 首章内容页的 1-based 页码 */
  firstContentPage: number;
}

export function computeToc(
  sections: TocSection[],
  opts: { coverPages: number; tocPages: number },
): TocResult {
  const start = opts.coverPages + opts.tocPages + 1;
  const entries: { title: string; page: number }[] = [];
  let cur = start;
  for (const s of sections) {
    entries.push({ title: s.title, page: cur });
    cur += s.count;
  }
  return { entries, firstContentPage: start };
}
