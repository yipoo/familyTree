/**
 * 树谱筛选条件：纯函数 + URL 序列化。
 *
 * 设计：
 *   - URL 是真相：所有 UI 状态都从 URL query 还原
 *   - 不匹配的节点默认"淡出"，不重新布局；勾选 hideUnmatched 才真正隐藏
 *   - 边只要两端有一端不匹配就跟着淡
 */

export type SexFilter = "MALE" | "FEMALE" | "UNKNOWN";
export type StatusFilter = "ALIVE" | "DECEASED";

export interface TreeFilter {
  /** 居住地 id 多选 */
  locationIds: string[];
  /** 字辈字符多选（按 person.generationChar 匹配） */
  generationChars: string[];
  /** 世代范围 [min, max]；任一端为 null 表示不限 */
  genFrom: number | null;
  genTo: number | null;
  /** 性别多选 */
  sexes: SexFilter[];
  /** 状态多选 */
  statuses: StatusFilter[];
  /** 是否真正隐藏不匹配（默认 false：仅淡出） */
  hideUnmatched: boolean;
}

export const EMPTY_FILTER: TreeFilter = {
  locationIds: [],
  generationChars: [],
  genFrom: null,
  genTo: null,
  sexes: [],
  statuses: [],
  hideUnmatched: false,
};

export function isFilterEmpty(f: TreeFilter): boolean {
  return (
    f.locationIds.length === 0 &&
    f.generationChars.length === 0 &&
    f.genFrom === null &&
    f.genTo === null &&
    f.sexes.length === 0 &&
    f.statuses.length === 0
  );
}

export function activeFilterCount(f: TreeFilter): number {
  let n = 0;
  if (f.locationIds.length) n += 1;
  if (f.generationChars.length) n += 1;
  if (f.genFrom !== null || f.genTo !== null) n += 1;
  if (f.sexes.length) n += 1;
  if (f.statuses.length) n += 1;
  return n;
}

// --------------------------------------------------------------------------
// URL 序列化 / 反序列化
// --------------------------------------------------------------------------

const KEYS = {
  loc: "loc",
  genChar: "genChar",
  genFrom: "genFrom",
  genTo: "genTo",
  sex: "sex",
  status: "fstatus", // 避免与人物详情页 status 冲突
  hide: "hideUnmatched",
} as const;

const VALID_SEX: ReadonlySet<SexFilter> = new Set([
  "MALE",
  "FEMALE",
  "UNKNOWN",
]);
const VALID_STATUS: ReadonlySet<StatusFilter> = new Set(["ALIVE", "DECEASED"]);

export function filterToQuery(f: TreeFilter): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.locationIds.length) q[KEYS.loc] = f.locationIds.join(",");
  if (f.generationChars.length) q[KEYS.genChar] = f.generationChars.join(",");
  if (f.genFrom !== null) q[KEYS.genFrom] = String(f.genFrom);
  if (f.genTo !== null) q[KEYS.genTo] = String(f.genTo);
  if (f.sexes.length) q[KEYS.sex] = f.sexes.join(",");
  if (f.statuses.length) q[KEYS.status] = f.statuses.join(",");
  if (f.hideUnmatched) q[KEYS.hide] = "1";
  return q;
}

function readList(s: string | null): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function readInt(s: string | null): number | null {
  if (s === null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** 反序列化：宽松解析，未知值丢弃，损坏值回落到 EMPTY */
export function parseFilterFromParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): TreeFilter {
  const get = (k: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(k);
    const v = (params as Record<string, string | string[] | undefined>)[k];
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };
  const sexes = readList(get(KEYS.sex)).filter((s): s is SexFilter =>
    VALID_SEX.has(s as SexFilter),
  );
  const statuses = readList(get(KEYS.status)).filter((s): s is StatusFilter =>
    VALID_STATUS.has(s as StatusFilter),
  );
  let genFrom = readInt(get(KEYS.genFrom));
  let genTo = readInt(get(KEYS.genTo));
  // 颠倒就纠正
  if (genFrom !== null && genTo !== null && genFrom > genTo) {
    [genFrom, genTo] = [genTo, genFrom];
  }
  return {
    locationIds: readList(get(KEYS.loc)),
    generationChars: readList(get(KEYS.genChar)),
    genFrom,
    genTo,
    sexes,
    statuses,
    hideUnmatched: get(KEYS.hide) === "1",
  };
}

// --------------------------------------------------------------------------
// 谓词
// --------------------------------------------------------------------------

export interface PersonForFilter {
  id: string;
  generation: number;
  generationChar: string | null;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  status: string;
}

/**
 * 给定一个人物 + 该人物（可能继承得来的）居住地 id，返回是否匹配筛选条件。
 *
 * 多个维度之间是 AND；同一维度内的多选是 OR。
 */
export function matchesFilter(
  person: PersonForFilter,
  residenceLocationId: string | null,
  f: TreeFilter,
): boolean {
  if (f.locationIds.length > 0) {
    if (!residenceLocationId) return false;
    if (!f.locationIds.includes(residenceLocationId)) return false;
  }
  if (f.generationChars.length > 0) {
    if (!person.generationChar) return false;
    if (!f.generationChars.includes(person.generationChar)) return false;
  }
  if (f.genFrom !== null && person.generation < f.genFrom) return false;
  if (f.genTo !== null && person.generation > f.genTo) return false;
  if (f.sexes.length > 0) {
    if (!f.sexes.includes(person.gender)) return false;
  }
  if (f.statuses.length > 0) {
    const s =
      person.status === "ALIVE" || person.status === "DECEASED"
        ? (person.status as StatusFilter)
        : null;
    if (!s || !f.statuses.includes(s)) return false;
  }
  return true;
}
