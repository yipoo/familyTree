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
  spouseNames: string[];
  childrenNames: string[];
  residenceText: string | null;
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
  };
  generationNames: { generation: number; character: string }[];
  volumes: AlbumVolume[];
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
    },
    generationNames: family.generationNames.map((g) => ({
      generation: g.generation,
      character: g.character,
    })),
    volumes,
    generatedAt: new Date().toISOString(),
    totalPersons: filtered.length,
  };
}

type PrismaPerson = Awaited<ReturnType<typeof prisma.person.findMany>>[number];
type PrismaLocation = Awaited<
  ReturnType<typeof prisma.location.findMany>
>[number];
type PersonWithResidence = PrismaPerson & { residence: PrismaLocation | null };

function buildChapters(
  list: PersonWithResidence[],
  generationNames: { generation: number; character: string }[],
  personById: Map<string, PersonWithResidence>,
  spousesOf: Map<string, string[]>,
  childrenOf: Map<string, string[]>,
  fatherOf: Map<string, string>,
  motherOf: Map<string, string>,
  resolveResidenceText: (p: PersonWithResidence) => string | null,
): AlbumChapter[] {
  const charByGen = new Map(generationNames.map((g) => [g.generation, g.character]));
  const byGen = new Map<number, AlbumPersonEntry[]>();

  for (const p of list) {
    const fatherId = fatherOf.get(p.id);
    const motherId = motherOf.get(p.id);
    const spouseIds = spousesOf.get(p.id) ?? [];
    const childIds = childrenOf.get(p.id) ?? [];

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
      spouseNames: spouseIds
        .map((id) => personById.get(id)?.name ?? "")
        .filter(Boolean),
      childrenNames: childIds
        .map((id) => personById.get(id)?.name ?? "")
        .filter(Boolean),
      residenceText: resolveResidenceText(p),
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
 * 把单个人物条目格式化为可读的"传记体"文字（用于册谱印刷与 PDF）。
 */
export function formatPersonEntryText(e: AlbumPersonEntry): string {
  const parts: string[] = [];
  parts.push(
    `【第 ${e.generation} 世${e.generationChar ? "·" + e.generationChar : ""}】 ${e.name}` +
      (e.alias ? `（${e.alias}）` : "") +
      `，${e.gender === "MALE" ? "男" : e.gender === "FEMALE" ? "女" : ""}` +
      (e.birthOrder ? `，行${e.birthOrder}` : "") +
      `。`,
  );
  if (e.fatherName || e.motherName) {
    const segs: string[] = [];
    if (e.fatherName) segs.push(`父：${e.fatherName}`);
    if (e.motherName) segs.push(`母：${e.motherName}`);
    parts.push(segs.join("，") + "。");
  }
  if (e.birthYear || e.birthDate) {
    parts.push(`生于${e.birthDate || `${e.birthYear}`}。`);
  }
  if (e.deathYear || e.deathDate) {
    parts.push(`卒于${e.deathDate || `${e.deathYear}`}。`);
  }
  if (e.birthPlace) parts.push(`出生地：${e.birthPlace}。`);
  if (e.residenceText) parts.push(`居：${e.residenceText}。`);
  if (e.succession) parts.push(`出承：${e.succession}。`);
  if (e.spouseNames.length > 0) {
    parts.push(`配：${e.spouseNames.join("、")}。`);
  }
  if (e.childrenNames.length > 0) {
    parts.push(`子女：${e.childrenNames.join("、")}（${e.childrenNames.length}人）。`);
  }
  if (e.paperRecord) parts.push(`纸谱行传：${e.paperRecord}`);
  if (e.biography) parts.push(`传：${e.biography}`);
  return parts.join("");
}
