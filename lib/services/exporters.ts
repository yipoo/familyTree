/**
 * 家族数据导出器：JSON / CSV / GEDCOM 5.5.1
 *
 * 输入：完整 prisma 拉取的快照
 * 输出：纯字符串（CSV / GEDCOM）或 JS 对象（JSON）
 */
import type { Gender } from "@/lib/generated/prisma/enums";

export interface ExportFamily {
  id: string;
  surname: string;
  name: string;
  description: string | null;
  founderName: string | null;
}

export interface ExportPerson {
  id: string;
  externalId: string | null;
  name: string;
  alias: string | null;
  gender: Gender;
  generation: number;
  generationChar: string | null;
  birthOrder: number | null;
  birthYear: number | null;
  deathYear: number | null;
  birthDate: string | null;
  deathDate: string | null;
  birthPlace: string | null;
  status: string;
  isMarriedIn: boolean;
  succession: string | null;
  paperRecord: string | null;
  biography: string | null;
  noteHint: string | null;
}

export interface ExportMarriage {
  id: string;
  husbandId: string;
  wifeId: string;
  type: string;
  order: number;
  marriedYear: number | null;
  endedYear: number | null;
}

export interface ExportParentChild {
  id: string;
  parentId: string;
  childId: string;
  relation: string;
  birthOrder: number | null;
  isPrimary: boolean;
}

export interface ExportSnapshot {
  family: ExportFamily;
  generationNames: { generation: number; character: string }[];
  persons: ExportPerson[];
  marriages: ExportMarriage[];
  parentChild: ExportParentChild[];
  generatedAt: string;
}

// ------------------------------------------------------------------
// JSON
// ------------------------------------------------------------------

export function toJson(snap: ExportSnapshot): string {
  return JSON.stringify(snap, null, 2);
}

// ------------------------------------------------------------------
// CSV：把核心人物表 + 关系表打包到一个 zip？为简化，直接拼合在多张 csv（多文件下载用 zip）
// 这里返回一个 record，调用方决定如何下发
// ------------------------------------------------------------------

export function toCsvBundle(snap: ExportSnapshot): {
  persons: string;
  marriages: string;
  parentChild: string;
  generationNames: string;
} {
  const personHeader = [
    "id",
    "externalId",
    "name",
    "alias",
    "gender",
    "generation",
    "generationChar",
    "birthOrder",
    "birthYear",
    "deathYear",
    "birthDate",
    "deathDate",
    "birthPlace",
    "status",
    "isMarriedIn",
    "succession",
    "biography",
    "noteHint",
    "paperRecord",
  ];
  const persons = csvOf(
    personHeader,
    snap.persons.map((p) =>
      personHeader.map((k) => csvCell((p as unknown as Record<string, unknown>)[k])),
    ),
  );

  const marriages = csvOf(
    ["id", "husbandId", "wifeId", "type", "order", "marriedYear", "endedYear"],
    snap.marriages.map((m) => [
      m.id,
      m.husbandId,
      m.wifeId,
      m.type,
      String(m.order),
      m.marriedYear ?? "",
      m.endedYear ?? "",
    ].map(csvCell)),
  );

  const parentChild = csvOf(
    ["id", "parentId", "childId", "relation", "birthOrder", "isPrimary"],
    snap.parentChild.map((pc) =>
      [pc.id, pc.parentId, pc.childId, pc.relation, pc.birthOrder ?? "", String(pc.isPrimary)].map(csvCell),
    ),
  );

  const generationNames = csvOf(
    ["generation", "character"],
    snap.generationNames.map((g) => [String(g.generation), g.character].map(csvCell)),
  );

  return { persons, marriages, parentChild, generationNames };
}

function csvOf(header: string[], rows: (string | number)[][]): string {
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function csvCell(v: unknown): string {
  if (v == null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  // RFC 4180：含 , " 换行，需双引号包裹并把 " 转 ""
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ------------------------------------------------------------------
// GEDCOM 5.5.1
// ------------------------------------------------------------------

/**
 * 导出 GEDCOM 5.5.1（基础字段子集）。
 *
 * 限制：
 *   - 不导出居住地 / 迁徙 / 文字传记（保留 NOTE 写一次）
 *   - 字辈以 NCHI 形式忽略，写到 NOTE 中
 */
export function toGedcom(snap: ExportSnapshot): string {
  const lines: string[] = [];
  lines.push("0 HEAD");
  lines.push("1 SOUR familyTree");
  lines.push("2 NAME familyTree CMS");
  lines.push("1 GEDC");
  lines.push("2 VERS 5.5.1");
  lines.push("2 FORM LINEAGE-LINKED");
  lines.push("1 CHAR UTF-8");

  const personIdToGid = new Map<string, string>();
  snap.persons.forEach((p, i) => personIdToGid.set(p.id, `@I${i + 1}@`));

  // INDI
  for (const p of snap.persons) {
    const gid = personIdToGid.get(p.id)!;
    lines.push(`0 ${gid} INDI`);
    lines.push(`1 NAME ${escGed(p.name)}`);
    lines.push(`1 SEX ${p.gender === "MALE" ? "M" : p.gender === "FEMALE" ? "F" : "U"}`);
    if (p.birthYear || p.birthDate) {
      lines.push("1 BIRT");
      if (p.birthDate) lines.push(`2 DATE ${escGed(p.birthDate)}`);
      else if (p.birthYear) lines.push(`2 DATE ${p.birthYear}`);
      if (p.birthPlace) lines.push(`2 PLAC ${escGed(p.birthPlace)}`);
    }
    if (p.deathYear || p.deathDate) {
      lines.push("1 DEAT");
      if (p.deathDate) lines.push(`2 DATE ${escGed(p.deathDate)}`);
      else if (p.deathYear) lines.push(`2 DATE ${p.deathYear}`);
    }
    if (p.alias) lines.push(`1 NICK ${escGed(p.alias)}`);
    const notes: string[] = [];
    if (p.generation) notes.push(`第 ${p.generation} 世${p.generationChar ? "·" + p.generationChar : ""}`);
    if (p.birthOrder) notes.push(`行 ${p.birthOrder}`);
    if (p.succession) notes.push(`出承：${p.succession}`);
    if (p.biography) notes.push(p.biography);
    if (p.paperRecord) notes.push(`纸谱行传：${p.paperRecord}`);
    if (p.noteHint) notes.push(`线索：${p.noteHint}`);
    for (const n of notes) lines.push(`1 NOTE ${escGed(n)}`);
  }

  // FAM（按婚姻聚合）
  const famIdByMarriage = new Map<string, string>();
  snap.marriages.forEach((m, i) => famIdByMarriage.set(m.id, `@F${i + 1}@`));

  // childToFamilies：按父+母 → fam
  const famByCouple = new Map<string, string>();
  for (const m of snap.marriages) {
    famByCouple.set(`${m.husbandId}::${m.wifeId}`, famIdByMarriage.get(m.id)!);
  }

  for (const m of snap.marriages) {
    const fid = famIdByMarriage.get(m.id)!;
    lines.push(`0 ${fid} FAM`);
    if (personIdToGid.has(m.husbandId))
      lines.push(`1 HUSB ${personIdToGid.get(m.husbandId)}`);
    if (personIdToGid.has(m.wifeId))
      lines.push(`1 WIFE ${personIdToGid.get(m.wifeId)}`);
    if (m.marriedYear) {
      lines.push("1 MARR");
      lines.push(`2 DATE ${m.marriedYear}`);
    }
    // 找子女：以 husband / wife 之一为父母都加进来；以 isPrimary 为准
    const childIds = new Set<string>();
    for (const pc of snap.parentChild) {
      if (pc.parentId === m.husbandId || pc.parentId === m.wifeId) {
        childIds.add(pc.childId);
      }
    }
    for (const cid of childIds) {
      if (personIdToGid.has(cid)) lines.push(`1 CHIL ${personIdToGid.get(cid)}`);
    }
  }

  lines.push("0 TRLR");
  return lines.join("\n");
}

function escGed(s: string): string {
  // GEDCOM 单行长度建议 <=255，这里只做换行替换
  return s.replace(/[\r\n]+/g, " ").trim();
}
