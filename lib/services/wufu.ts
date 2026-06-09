/**
 * 五服图（本宗九族五服之图）
 *
 * 以某人 `己`（root）为中心，计算其「本宗」（同宗 / 父系血亲，含本族女儿、
 * 嫁入之妻）在五服之内的亲属，并给出每人的：
 *   - 称谓（父、祖、伯叔父、堂兄弟、侄、孙……）
 *   - 服制等级（斩衰 / 齐衰 / 大功 / 小功 / 缌麻）
 *   - 世代偏移（相对己的辈分）
 *
 * 算法：
 *   1. 沿父系（male parent，优先 isPrimary）为每个人建「父系上溯链」。
 *   2. 对家族中每个人 R，求 R 与己的「最近共同父系祖先」(NCA)：
 *        u = 己 上溯到 NCA 的代数
 *        d = R  上溯到 NCA 的代数
 *      仅 u≤4 且 d≤4（即 NCA 在高祖以内、且不超出玄孙辈）才属本宗五服。
 *   3. (u,d) → 服制 + 称谓，查《本宗九族五服图》通行表（见下 GRADE/TERM）。
 *   4. 嫁入之妻：作为已纳入男性的配偶补入，服随夫、称谓取对应女称。
 *
 * 说明：服制历代有《仪礼》本与后世简化本之别（尤以曾祖 / 高祖 / 侄 的等级
 * 各家略异）。本表采用「通行本宗九族五服图」，并以「亲等递减」保持自洽；
 * 如需严格依某一典制，可调整 GRADE 表。本算法为纯函数，便于单测。
 */

export type WufuGrade = "斩衰" | "齐衰" | "大功" | "小功" | "缌麻";

export interface WufuPerson {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  birthYear?: number | null;
  birthOrder?: number | null;
}

export interface WufuParentChild {
  parentId: string;
  childId: string;
  isPrimary?: boolean;
}

export interface WufuMarriage {
  husbandId: string;
  wifeId: string;
}

export interface WufuMember {
  personId: string | null; // 配偶若不在库中可为 null（一般都在库）
  name: string;
  term: string; // 称谓
  grade: WufuGrade | null; // null = 己本人
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  genOffset: number; // 相对己的辈分：负=长辈，0=平辈，正=晚辈
  branch: number; // 上溯到 NCA 的代数 u（0=直系本支，越大越疏）
  /** 旁系列号 = min(u,d)：0=直系本支，1=兄弟/伯叔/侄 行，2=堂，3=再从，4=族。用于五服图网格列定位 */
  col: number;
  isSelf: boolean;
  isSpouse: boolean;
  /** 配偶所系的本宗成员 personId（仅 isSpouse 时有值），用于树图把配偶挂到其夫名下 */
  spouseOf?: string | null;
}

export interface WufuGeneration {
  genOffset: number;
  label: string; // 高祖辈 / 曾祖辈 / 祖辈 / 父辈 / 己辈 / 子辈 / 孙辈 / 曾孙辈 / 玄孙辈
  members: WufuMember[];
}

export interface WufuChart {
  rootPersonId: string;
  rootName: string;
  generations: WufuGeneration[];
  counts: Record<WufuGrade, number>;
  total: number; // 含己
}

/** 服制配色（由重到轻）——组件直接用 */
export const WUFU_GRADE_META: Array<{ grade: WufuGrade; desc: string; color: string }> = [
  { grade: "斩衰", desc: "最重（父）", color: "#b91c1c" },
  { grade: "齐衰", desc: "次重（祖、兄弟、子）", color: "#ea580c" },
  { grade: "大功", desc: "中（堂兄弟、孙、侄）", color: "#ca8a04" },
  { grade: "小功", desc: "轻（再从、侄孙）", color: "#16a34a" },
  { grade: "缌麻", desc: "最轻（族、玄孙）", color: "#2563eb" },
];

// (u,d) → 服制；u=己上溯到NCA代数，d=亲属上溯到NCA代数。0..4。
// 行 u，列 d。
const GRADE: (WufuGrade | null)[][] = [
  // d=0     1       2       3       4
  [null, "齐衰", "大功", "缌麻", "缌麻"], // u0: 己/子/孙/曾孙/玄孙
  ["斩衰", "齐衰", "大功", "小功", "缌麻"], // u1: 父/兄弟/侄/侄孙/侄曾孙
  ["齐衰", "齐衰", "大功", "小功", "缌麻"], // u2: 祖/伯叔父/堂兄弟/堂侄/堂侄孙
  ["齐衰", "小功", "小功", "小功", "缌麻"], // u3: 曾祖/伯叔祖父/从祖父/再从兄弟/再从侄
  ["缌麻", "缌麻", "缌麻", "缌麻", "缌麻"], // u4: 高祖/族曾祖/族祖/族父/族兄弟
];

// (u,d) → 称谓 {男, 女}
const TERM: { m: string; f: string }[][] = [
  [
    { m: "己", f: "己" },
    { m: "子", f: "女" },
    { m: "孙", f: "孙女" },
    { m: "曾孙", f: "曾孙女" },
    { m: "玄孙", f: "玄孙女" },
  ],
  [
    { m: "父", f: "母" },
    { m: "兄弟", f: "姊妹" },
    { m: "侄", f: "侄女" },
    { m: "侄孙", f: "侄孙女" },
    { m: "侄曾孙", f: "侄曾孙女" },
  ],
  [
    { m: "祖父", f: "祖母" },
    { m: "伯叔父", f: "姑" },
    { m: "堂兄弟", f: "堂姊妹" },
    { m: "堂侄", f: "堂侄女" },
    { m: "堂侄孙", f: "堂侄孙女" },
  ],
  [
    { m: "曾祖父", f: "曾祖母" },
    { m: "伯叔祖父", f: "姑祖母" },
    { m: "从祖父", f: "从祖姑" },
    { m: "再从兄弟", f: "再从姊妹" },
    { m: "再从侄", f: "再从侄女" },
  ],
  [
    { m: "高祖父", f: "高祖母" },
    { m: "族曾祖父", f: "族曾祖姑" },
    { m: "族祖父", f: "族祖姑" },
    { m: "族父", f: "族姑" },
    { m: "族兄弟", f: "族姊妹" },
  ],
];

const GEN_LABEL: Record<number, string> = {
  [-4]: "高祖辈",
  [-3]: "曾祖辈",
  [-2]: "祖辈",
  [-1]: "父辈",
  [0]: "己辈（平辈）",
  [1]: "子辈",
  [2]: "孙辈",
  [3]: "曾孙辈",
  [4]: "玄孙辈",
};

const MAX = 4;

export function computeWufu(input: {
  rootPersonId: string;
  persons: WufuPerson[];
  parentChild: WufuParentChild[];
  marriages: WufuMarriage[];
}): WufuChart | null {
  const byId = new Map(input.persons.map((p) => [p.id, p]));
  const root = byId.get(input.rootPersonId);
  if (!root) return null;

  // 父系：childId -> 男性 parentId（优先 isPrimary）
  const fatherOf = new Map<string, string>();
  for (const pc of input.parentChild) {
    const parent = byId.get(pc.parentId);
    if (!parent || parent.gender !== "MALE") continue;
    if (!byId.has(pc.childId)) continue;
    if (!fatherOf.has(pc.childId) || pc.isPrimary) {
      fatherOf.set(pc.childId, pc.parentId);
    }
  }

  // 父系上溯链（含自身），最多 MAX+1 层
  function chainUp(id: string): string[] {
    const chain: string[] = [];
    const seen = new Set<string>();
    let cur: string | undefined = id;
    let depth = 0;
    while (cur && !seen.has(cur) && depth <= MAX) {
      seen.add(cur);
      chain.push(cur);
      cur = fatherOf.get(cur);
      depth++;
    }
    return chain;
  }

  const jiChain = chainUp(input.rootPersonId);
  const jiIndex = new Map(jiChain.map((id, i) => [id, i]));

  // 配偶索引
  const spousesOf = new Map<string, string[]>();
  for (const m of input.marriages) {
    if (!byId.has(m.husbandId) || !byId.has(m.wifeId)) continue;
    (spousesOf.get(m.husbandId) ?? spousesOf.set(m.husbandId, []).get(m.husbandId)!).push(m.wifeId);
    (spousesOf.get(m.wifeId) ?? spousesOf.set(m.wifeId, []).get(m.wifeId)!).push(m.husbandId);
  }

  const included = new Set<string>();
  const members: WufuMember[] = [];

  // 主体：本宗血亲（含本族女儿）
  for (const p of input.persons) {
    const rChain = chainUp(p.id);
    // 找最近共同父系祖先
    let u = -1;
    let d = -1;
    for (let di = 0; di < rChain.length; di++) {
      const ui = jiIndex.get(rChain[di]);
      if (ui !== undefined) {
        u = ui;
        d = di;
        break;
      }
    }
    if (u < 0 || d < 0 || u > MAX || d > MAX) continue;

    const isSelf = p.id === input.rootPersonId;
    const grade = isSelf ? null : GRADE[u][d];
    const termCell = TERM[u][d];
    let term = isSelf ? "己" : p.gender === "FEMALE" ? termCell.f : termCell.m;
    if (!isSelf) term = decorateSeniority(term, p, root);

    included.add(p.id);
    members.push({
      personId: p.id,
      name: p.name,
      term,
      grade,
      gender: p.gender,
      genOffset: d - u,
      branch: u,
      col: Math.min(u, d),
      isSelf,
      isSpouse: false,
    });
  }

  // 配偶（嫁入之妻 / 己之配偶）：服随夫，称谓取对应女称或「X妻」
  for (const m of [...members]) {
    if (m.isSpouse || !m.personId) continue;
    for (const spId of spousesOf.get(m.personId) ?? []) {
      if (included.has(spId)) continue; // 已作为本宗纳入（如族内通婚极少见）
      const sp = byId.get(spId);
      if (!sp) continue;
      included.add(spId);
      const term = spouseTerm(m, sp);
      members.push({
        personId: spId,
        name: sp.name,
        term,
        grade: m.grade, // 妻随夫服（简化）
        gender: sp.gender,
        genOffset: m.genOffset,
        branch: m.branch,
        col: m.col,
        isSelf: false,
        isSpouse: true,
        spouseOf: m.personId,
      });
    }
  }

  // 分代归并
  const genMap = new Map<number, WufuMember[]>();
  for (const mem of members) {
    (genMap.get(mem.genOffset) ?? genMap.set(mem.genOffset, []).get(mem.genOffset)!).push(mem);
  }
  const generations: WufuGeneration[] = [];
  for (let g = -MAX; g <= MAX; g++) {
    const list = genMap.get(g);
    if (!list || list.length === 0) continue;
    // 排序：本支(branch小)在前，己优先，再按出生年/排行/姓名
    list.sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      if (a.branch !== b.branch) return a.branch - b.branch;
      if (a.isSpouse !== b.isSpouse) return a.isSpouse ? 1 : -1;
      const ay = a.personId ? byId.get(a.personId)?.birthYear ?? null : null;
      const by = b.personId ? byId.get(b.personId)?.birthYear ?? null : null;
      if (ay != null && by != null && ay !== by) return ay - by;
      return a.name.localeCompare(b.name, "zh");
    });
    generations.push({ genOffset: g, label: GEN_LABEL[g] ?? `${g}辈`, members: list });
  }

  const counts: Record<WufuGrade, number> = {
    斩衰: 0,
    齐衰: 0,
    大功: 0,
    小功: 0,
    缌麻: 0,
  };
  for (const mem of members) if (mem.grade) counts[mem.grade]++;

  return {
    rootPersonId: input.rootPersonId,
    rootName: root.name,
    generations,
    counts,
    total: members.length,
  };
}

/** 平辈区分兄/弟、姊/妹；长辈区分伯/叔——按出生年或排行相对己判断。 */
function decorateSeniority(term: string, p: WufuPerson, root: WufuPerson): string {
  const elder = isElder(p, root);
  if (term === "兄弟") return elder == null ? "兄弟" : elder ? "兄" : "弟";
  if (term === "姊妹") return elder == null ? "姊妹" : elder ? "姊" : "妹";
  if (term === "伯叔父") return elder == null ? "伯叔父" : elder ? "伯父" : "叔父";
  if (term === "堂兄弟") return elder == null ? "堂兄弟" : elder ? "堂兄" : "堂弟";
  if (term === "再从兄弟") return elder == null ? "再从兄弟" : elder ? "再从兄" : "再从弟";
  if (term === "族兄弟") return elder == null ? "族兄弟" : elder ? "族兄" : "族弟";
  return term;
}

/** p 是否年长于 root（同辈比较）：优先出生年，其次排行；都缺返回 null。 */
function isElder(p: WufuPerson, root: WufuPerson): boolean | null {
  if (p.birthYear != null && root.birthYear != null && p.birthYear !== root.birthYear) {
    return p.birthYear < root.birthYear;
  }
  if (p.birthOrder != null && root.birthOrder != null && p.birthOrder !== root.birthOrder) {
    return p.birthOrder < root.birthOrder;
  }
  return null;
}

function spouseTerm(husband: WufuMember, spouse: WufuPerson): string {
  // 己之配偶
  if (husband.isSelf) return spouse.gender === "MALE" ? "夫" : "妻";
  // 直系长辈之妻用女称（母/祖母/曾祖母/高祖母）
  if (husband.branch === husband.genOffset * -1 && husband.genOffset < 0 && husband.branch <= MAX) {
    const u = husband.branch;
    const cell = TERM[u]?.[0];
    if (cell && spouse.gender !== "MALE") return cell.f;
  }
  // 其余：夫之称谓 + 妻
  return `${husband.term}${spouse.gender === "MALE" ? "夫" : "妻"}`;
}
