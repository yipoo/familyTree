/**
 * 册谱数据装配
 *
 * 把家族数据组织成"书"结构：
 *   - 封面：家族名 / 始祖 / 时间
 *   - 序：description / 字辈表
 *   - 卷：按支系分卷（无支系时整族一卷）
 *     - 章：每代一章
 *       - 人物条目：完整文字记述
 *
 * 输出 AlbumBook 同时供 HTML 页面与 react-pdf 使用。
 */
import { prisma } from "@/lib/db";
import {
  resolveAlbumSections,
  type ResolvedSection,
} from "@/lib/services/album-sections";
import { ossSignIfOurs } from "@/lib/services/oss";

export interface AlbumSpouse {
  name: string;
  /** 元配 / 继配 / 妾 / 入赘等 */
  type: "PRIMARY" | "SECONDARY" | "CONCUBINE" | "UXORILOCAL" | string;
  order: number;
}

export interface AlbumPersonEntry {
  id: string;
  name: string;
  alias: string | null;
  generation: number;
  generationChar: string | null;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  birthOrder: number | null;
  birthYear: number | null;
  deathYear: number | null;
  birthDate: string | null;
  deathDate: string | null;
  birthPlace: string | null;
  status: string;
  succession: string | null;
  isMarriedIn: boolean;
  paperRecord: string | null;
  biography: string | null;
  noteHint: string | null;

  fatherName: string | null;
  motherName: string | null;
  /** 配偶（按 marriage.order 升序） */
  spouses: AlbumSpouse[];
  /** @deprecated 旧版字段，保留向后兼容；新代码用 spouses */
  spouseNames: string[];
  /** 儿子姓名（按 birthOrder） */
  sons: string[];
  /** 女儿姓名（按 birthOrder） */
  daughters: string[];
  /** @deprecated 旧版字段；新代码用 sons + daughters */
  childrenNames: string[];
  residenceText: string | null;
  /** 享年（依生卒年估算；缺数据则为 null） */
  ageAtDeath: number | null;
}

export interface AlbumChapter {
  generation: number;
  generationChar: string | null;
  entries: AlbumPersonEntry[];
}

export interface AlbumVolume {
  branchId: string | null;
  branchName: string;
  /** 该卷条目数 */
  count: number;
  chapters: AlbumChapter[];
}

export interface AlbumBook {
  family: {
    id: string;
    name: string;
    surname: string;
    description: string | null;
    founderName: string | null;
    /** 族规家训 */
    familyRules: string | null;
    /** 修谱版次（如"初修"、"三续"） */
    editionInfo: string | null;
    /** 姓氏源流叙述（用户可填的覆盖文，未填则用模板） */
    surnameOrigin: string | null;
  };
  generationNames: { generation: number; character: string }[];
  volumes: AlbumVolume[];
  /**
   * 前置章节（封面/凡例/谱序/源流/族规/跋/自定义…）的解析结果。
   * 无 DB 记录时由 resolveAlbumSections 回退到默认列表（向后兼容）。
   * 合编本渲染器（HTML + PDF）按此 order 遍历分派。
   */
  sections: ResolvedSection[];
  /** 修谱人员数（族长 / 管理员），供凡例等文案在两端复用（PDF 端无完整成员数据）。 */
  compilerCount: number;
  generatedAt: string;
  totalPersons: number;
}

interface BuildOptions {
  /** 仅父系（默认）；包含外嫁女则改 false */
  paternalOnly?: boolean;
  /** 仅 inserted 进册的支系；空表示全部 */
  branchIds?: string[];
}

export async function buildAlbumBook(
  familyId: string,
  opts: BuildOptions = {},
): Promise<AlbumBook | null> {
  const family = await prisma.family.findFirst({
    where: { id: familyId, deletedAt: null },
    include: {
      generationNames: { orderBy: { generation: "asc" } },
      branches: { orderBy: { name: "asc" } },
    },
  });
  if (!family) return null;

  const persons = await prisma.person.findMany({
    where: { familyId, deletedAt: null },
    include: {
      residence: true,
    },
    orderBy: [{ generation: "asc" }, { birthOrder: "asc" }, { createdAt: "asc" }],
  });

  const marriages = await prisma.marriage.findMany({
    where: { familyId },
    orderBy: { order: "asc" },
  });
  const parentChild = await prisma.parentChild.findMany({
    where: { familyId },
  });

  // 前置章节（无记录 → resolveAlbumSections 回退默认列表）；imageUrl 读时重签名
  const sectionRows = await prisma.albumSection.findMany({
    where: { familyId },
    orderBy: { order: "asc" },
  });
  const sections = resolveAlbumSections(sectionRows).map((s) =>
    s.imageUrl ? { ...s, imageUrl: ossSignIfOurs(s.imageUrl) } : s,
  );

  // 修谱人员数（族长 / 管理员）——供两端凡例文案复用
  const compilerCount = await prisma.familyMember.count({
    where: { familyId, role: { in: ["OWNER", "ADMIN"] } },
  });

  const personById = new Map(persons.map((p) => [p.id, p]));

  // 父亲 / 母亲 / 配偶 / 子女
  const fatherOf = new Map<string, string>();
  const motherOf = new Map<string, string>();
  for (const pc of parentChild) {
    const parent = personById.get(pc.parentId);
    if (!parent) continue;
    if (parent.gender === "MALE" && !fatherOf.has(pc.childId))
      fatherOf.set(pc.childId, pc.parentId);
    if (parent.gender === "FEMALE" && !motherOf.has(pc.childId))
      motherOf.set(pc.childId, pc.parentId);
  }
  const childrenOf = new Map<string, string[]>();
  for (const pc of parentChild) {
    const arr = childrenOf.get(pc.parentId) ?? [];
    if (!arr.includes(pc.childId)) arr.push(pc.childId);
    childrenOf.set(pc.parentId, arr);
  }
  // 子女按 birthOrder
  for (const [pid, kids] of childrenOf) {
    kids.sort((a, b) => {
      const ba = personById.get(a)?.birthOrder ?? 99;
      const bb = personById.get(b)?.birthOrder ?? 99;
      return ba - bb;
    });
    childrenOf.set(pid, kids);
  }

  // 配偶
  const spousesOf = new Map<string, string[]>();
  for (const m of marriages) {
    const arrH = spousesOf.get(m.husbandId) ?? [];
    arrH.push(m.wifeId);
    spousesOf.set(m.husbandId, arrH);
    const arrW = spousesOf.get(m.wifeId) ?? [];
    arrW.push(m.husbandId);
    spousesOf.set(m.wifeId, arrW);
  }

  // 居住地继承解析（简易）
  function resolveResidenceText(p: typeof persons[number]): string | null {
    if (p.residence) return p.residence.fullText;
    let cur: typeof persons[number] | undefined = p;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      const parentId = cur.isMarriedIn
        ? marriages.find((m) => m.wifeId === cur!.id)?.husbandId
        : fatherOf.get(cur.id);
      if (!parentId) return null;
      const next = personById.get(parentId);
      if (!next) return null;
      if (next.residence) return next.residence.fullText;
      cur = next;
    }
    return null;
  }

  // 过滤：paternalOnly=true 时跳过外嫁女（gender=FEMALE && !isMarriedIn）
  const paternalOnly = opts.paternalOnly !== false; // 默认 true
  const filtered = persons.filter((p) => {
    if (paternalOnly && p.gender === "FEMALE" && !p.isMarriedIn) return false;
    return true;
  });

  // 按支系分卷
  const branchById = new Map(family.branches.map((b) => [b.id, b]));
  const wantedBranchIds = opts.branchIds && opts.branchIds.length > 0 ? new Set(opts.branchIds) : null;

  const byBranch = new Map<string | null, typeof filtered>();
  for (const p of filtered) {
    const key = p.branchId ?? null;
    if (wantedBranchIds && key && !wantedBranchIds.has(key)) continue;
    if (wantedBranchIds && !key) continue;
    const arr = byBranch.get(key) ?? [];
    arr.push(p);
    byBranch.set(key, arr);
  }

  const volumes: AlbumVolume[] = [];
  const branchKeys = Array.from(byBranch.keys()).sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    const an = branchById.get(a)?.name ?? "";
    const bn = branchById.get(b)?.name ?? "";
    return an.localeCompare(bn);
  });
  for (const bk of branchKeys) {
    const list = byBranch.get(bk) ?? [];
    const chapters = buildChapters(
      list,
      family.generationNames,
      personById,
      spousesOf,
      childrenOf,
      fatherOf,
      motherOf,
      resolveResidenceText,
      marriages,
    );
    volumes.push({
      branchId: bk,
      branchName: bk ? branchById.get(bk)?.name ?? "未命名支" : "（未分支）",
      count: list.length,
      chapters,
    });
  }

  return {
    family: {
      id: family.id,
      name: family.name,
      surname: family.surname,
      description: family.description,
      founderName: family.founderName,
      familyRules: family.familyRules,
      editionInfo: family.editionInfo,
      surnameOrigin: family.surnameOrigin,
    },
    generationNames: family.generationNames.map((g) => ({
      generation: g.generation,
      character: g.character,
    })),
    volumes,
    sections,
    compilerCount,
    generatedAt: new Date().toISOString(),
    totalPersons: filtered.length,
  };
}

type PrismaPerson = Awaited<ReturnType<typeof prisma.person.findMany>>[number];
type PrismaLocation = Awaited<
  ReturnType<typeof prisma.location.findMany>
>[number];
type PersonWithResidence = PrismaPerson & { residence: PrismaLocation | null };

type MarriageRow = Awaited<
  ReturnType<typeof prisma.marriage.findMany>
>[number];

function buildChapters(
  list: PersonWithResidence[],
  generationNames: { generation: number; character: string }[],
  personById: Map<string, PersonWithResidence>,
  spousesOf: Map<string, string[]>,
  childrenOf: Map<string, string[]>,
  fatherOf: Map<string, string>,
  motherOf: Map<string, string>,
  resolveResidenceText: (p: PersonWithResidence) => string | null,
  marriages: MarriageRow[],
): AlbumChapter[] {
  const charByGen = new Map(generationNames.map((g) => [g.generation, g.character]));
  const byGen = new Map<number, AlbumPersonEntry[]>();

  // 当前 person 视角下的婚姻记录索引，用于查 type / order
  // 男性视角：m.husbandId === self.id；女性视角：m.wifeId === self.id
  const marriagesByPerson = new Map<string, MarriageRow[]>();
  for (const m of marriages) {
    const arrH = marriagesByPerson.get(m.husbandId) ?? [];
    arrH.push(m);
    marriagesByPerson.set(m.husbandId, arrH);
    const arrW = marriagesByPerson.get(m.wifeId) ?? [];
    arrW.push(m);
    marriagesByPerson.set(m.wifeId, arrW);
  }

  for (const p of list) {
    const fatherId = fatherOf.get(p.id);
    const motherId = motherOf.get(p.id);
    const spouseIds = spousesOf.get(p.id) ?? [];
    const childIds = childrenOf.get(p.id) ?? [];

    // 配偶（带 type / order）
    const myMarriages = (marriagesByPerson.get(p.id) ?? []).slice().sort(
      (a, b) => a.order - b.order,
    );
    const spouses: AlbumSpouse[] = [];
    for (const m of myMarriages) {
      const otherId = m.husbandId === p.id ? m.wifeId : m.husbandId;
      const other = personById.get(otherId);
      if (!other) continue;
      spouses.push({ name: other.name, type: String(m.type), order: m.order });
    }

    // 子女按 gender 分组
    const sons: string[] = [];
    const daughters: string[] = [];
    for (const cid of childIds) {
      const c = personById.get(cid);
      if (!c) continue;
      if (c.gender === "MALE") sons.push(c.name);
      else if (c.gender === "FEMALE") daughters.push(c.name);
      else sons.push(c.name); // 未知性别归到子，避免漏记
    }

    // 享年
    let ageAtDeath: number | null = null;
    if (p.birthYear && p.deathYear && p.deathYear >= p.birthYear) {
      ageAtDeath = p.deathYear - p.birthYear + 1; // 中国传统年龄计算（虚岁）
    }

    const entry: AlbumPersonEntry = {
      id: p.id,
      name: p.name,
      alias: p.alias,
      generation: p.generation,
      generationChar: p.generationChar,
      gender: p.gender,
      birthOrder: p.birthOrder,
      birthYear: p.birthYear,
      deathYear: p.deathYear,
      birthDate: p.birthDate,
      deathDate: p.deathDate,
      birthPlace: p.birthPlace,
      status: p.status,
      succession: p.succession,
      isMarriedIn: p.isMarriedIn,
      paperRecord: p.paperRecord,
      biography: p.biography,
      noteHint: p.noteHint,
      fatherName: fatherId ? personById.get(fatherId)?.name ?? null : null,
      motherName: motherId ? personById.get(motherId)?.name ?? null : null,
      spouses,
      spouseNames: spouseIds
        .map((id) => personById.get(id)?.name ?? "")
        .filter(Boolean),
      sons,
      daughters,
      childrenNames: childIds
        .map((id) => personById.get(id)?.name ?? "")
        .filter(Boolean),
      residenceText: resolveResidenceText(p),
      ageAtDeath,
    };

    const arr = byGen.get(p.generation) ?? [];
    arr.push(entry);
    byGen.set(p.generation, arr);
  }

  return Array.from(byGen.keys())
    .sort((a, b) => a - b)
    .map((g) => ({
      generation: g,
      generationChar: charByGen.get(g) ?? null,
      entries: byGen.get(g) ?? [],
    }));
}

/**
 * 把单个人物条目格式化为可读的"传记体"文字（仿传统印刷家谱牒记 / 行传体）。
 *
 * 行文顺序：
 *   名（字号）+ 性别 + 行第
 *   父：xx，母：xx
 *   生于 xx 月 xx，卒于 xx 月 xx，享年 xx
 *   出生地 / 居 / 出承
 *   配：元配 xx 氏，继配 xx 氏，妾 xx 氏
 *   子 N：xx、xx；女 N：xx、xx
 *   纸谱行传 / 传略
 */
export function formatPersonEntryText(e: AlbumPersonEntry): string {
  const parts: string[] = [];
  parts.push(
    `【第 ${e.generation} 世${e.generationChar ? "·" + e.generationChar : ""}】 ${e.name}` +
      (e.alias ? `（字${e.alias}）` : "") +
      `，${e.gender === "MALE" ? "男" : e.gender === "FEMALE" ? "女" : ""}` +
      (e.birthOrder ? `，行${numToHan(e.birthOrder)}` : "") +
      `。`,
  );
  if (e.fatherName || e.motherName) {
    const segs: string[] = [];
    if (e.fatherName) segs.push(`父：${e.fatherName}`);
    if (e.motherName) segs.push(`母：${e.motherName}`);
    parts.push(segs.join("，") + "。");
  }
  // 生卒
  const birth = e.birthDate || (e.birthYear ? `${e.birthYear} 年` : null);
  const death = e.deathDate || (e.deathYear ? `${e.deathYear} 年` : null);
  if (birth) parts.push(`生于${birth}。`);
  if (death) parts.push(`卒于${death}。`);
  if (e.ageAtDeath) parts.push(`享年 ${e.ageAtDeath} 岁。`);
  if (e.birthPlace) parts.push(`出生于 ${e.birthPlace}。`);
  if (e.residenceText) parts.push(`居：${e.residenceText}。`);
  if (e.succession) parts.push(`出承：${e.succession}。`);

  // 配偶（按 type 分组并标注）
  if (e.spouses.length > 0) {
    const spouseSegs: string[] = [];
    for (const s of e.spouses) {
      const label = marriageTypeLabel(s.type);
      spouseSegs.push(`${label} ${s.name}${spouseSurnameSuffix(s.name, e.gender)}`);
    }
    parts.push(`配：${spouseSegs.join("，")}。`);
  } else if (e.spouseNames.length > 0) {
    // 兼容旧数据
    parts.push(`配：${e.spouseNames.join("、")}。`);
  }

  // 子女（分别记 子 N / 女 N）
  if (e.sons.length > 0 || e.daughters.length > 0) {
    const segs: string[] = [];
    if (e.sons.length > 0) {
      segs.push(`子${numToHan(e.sons.length)}：${e.sons.join("、")}`);
    }
    if (e.daughters.length > 0) {
      segs.push(`女${numToHan(e.daughters.length)}：${e.daughters.join("、")}`);
    }
    parts.push(segs.join("；") + "。");
  } else if (e.childrenNames.length > 0) {
    // 兼容旧数据
    parts.push(`子女：${e.childrenNames.join("、")}（${e.childrenNames.length} 人）。`);
  }

  if (e.paperRecord) parts.push(`纸谱行传：${e.paperRecord}`);
  if (e.biography) parts.push(`传：${e.biography}`);
  return parts.join("");
}

function marriageTypeLabel(type: string): string {
  switch (type) {
    case "PRIMARY":
      return "元配";
    case "SECONDARY":
      return "继配";
    case "CONCUBINE":
      return "妾";
    case "UXORILOCAL":
      return "招赘";
    default:
      return "配";
  }
}

/**
 * 给配偶名字附"氏"后缀（仅当 self 为 MALE 且配偶名字看起来不含"氏"已经写明）。
 * 简化处理：如配偶名只有 1-2 字，可能是单个姓氏，则不附"氏"；否则给个保守默认。
 * 实际数据多样，这里返回空字符串避免误添。
 */
function spouseSurnameSuffix(_name: string, _selfGender: string): string {
  return "";
}

function numToHan(n: number): string {
  const map = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (n <= 10) return map[n];
  if (n < 20) return "十" + map[n - 10];
  return String(n);
}
