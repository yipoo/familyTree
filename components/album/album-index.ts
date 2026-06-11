/**
 * 册谱页内人物索引：name → 页码（0-based，指向 pages[] 下标）。
 * 各体例 builder 在生成页时一并产出，供 BookViewer 搜索定位到具体页。
 */
export interface AlbumIndexEntry {
  name: string;
  alias?: string | null;
  generation: number;
  /** 0-based：pages[] 下标 */
  page: number;
}

export interface AlbumBuild {
  pages: React.ReactNode[];
  index: AlbumIndexEntry[];
}

/** 把相对页码的索引整体平移 by 页（用于把子段索引并入全书）。 */
export function offsetIndex(idx: AlbumIndexEntry[], by: number): AlbumIndexEntry[] {
  return idx.map((e) => ({ ...e, page: e.page + by }));
}
