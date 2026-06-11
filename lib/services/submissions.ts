/**
 * 提交（PendingSubmission）payload 设计与应用
 *
 * 支持：
 *   - person-update    ：编辑某人物的字段（成员建议 / 二维码采集校正本人）
 *   - person-add-child ：为某人物添加一名子女（二维码采集"补全子女"）
 *
 * 二维码采集来的提交带 source="collect" 与 contributor（填写人自报身份）。
 * 后续可扩展：person-delete / parents-change / residence-set 等。
 */
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { Gender, LifeStatus, ParentRelation } from "@/lib/generated/prisma/enums";

export type SubmissionSource = "member" | "collect";

/** 二维码采集时填写人自报身份 */
export interface Contributor {
  name?: string;
  phone?: string;
  relation?: string; // 与目标人物的关系，如"本人""长子"
}

export interface NewChild {
  name: string;
  gender: Gender;
  birthOrder?: number | null;
  birthYear?: number | null;
  birthPlace?: string | null;
  note?: string | null;
  relation?: ParentRelation;
}

export type SubmissionPayload =
  | {
      kind: "person-update";
      personId: string;
      personName: string; // 冗余存储便于审核界面展示
      changes: PersonUpdateChanges;
      source?: SubmissionSource;
      contributor?: Contributor;
      /** 采集到的联系手机号哈希（已在提交时哈希，不存明文）；批准后写入用于小程序自动定位 */
      contactPhoneHash?: string | null;
    }
  | {
      kind: "person-add-child";
      parentId: string;
      parentName: string;
      child: NewChild;
      source?: SubmissionSource;
      contributor?: Contributor;
    };

export type PersonUpdateChanges = {
  name?: string;
  alias?: string | null;
  birthOrder?: number | null;
  status?: "ALIVE" | "DECEASED" | "LOST" | "UNKNOWN";
  birthYear?: number | null;
  deathYear?: number | null;
  birthPlace?: string | null;
  biography?: string | null;
  note?: string | null;
};

const PERSON_UPDATE_FIELDS: Array<keyof PersonUpdateChanges> = [
  "name",
  "alias",
  "birthOrder",
  "status",
  "birthYear",
  "deathYear",
  "birthPlace",
  "biography",
  "note",
];

/** 把 FormData 收成 changes 对象，仅保留与原值不同的字段。 */
export function diffPersonUpdate(
  original: Record<string, unknown>,
  formData: FormData,
): PersonUpdateChanges {
  const out: PersonUpdateChanges = {};
  for (const f of PERSON_UPDATE_FIELDS) {
    const raw = formData.get(f);
    if (raw === null) continue;
    const str = String(raw);
    let next: PersonUpdateChanges[typeof f];
    if (f === "birthOrder" || f === "birthYear" || f === "deathYear") {
      next = str === "" ? null : Number(str);
      if (typeof next === "number" && !Number.isFinite(next)) continue;
    } else if (f === "status") {
      if (!["ALIVE", "DECEASED", "LOST", "UNKNOWN"].includes(str)) continue;
      next = str as PersonUpdateChanges["status"];
    } else if (f === "name") {
      const t = str.trim();
      if (!t) continue;
      next = t;
    } else {
      next = str === "" ? null : str;
    }
    if (next !== original[f]) {
      (out as Record<string, unknown>)[f] = next;
    }
  }
  return out;
}

export function describePayload(p: SubmissionPayload): string {
  let base: string;
  if (p.kind === "person-update") {
    const keys = Object.keys(p.changes);
    base = `修改 ${p.personName} 的 ${keys.length} 个字段：${keys.join("、")}`;
  } else if (p.kind === "person-add-child") {
    base = `为 ${p.parentName} 添加子女：${p.child.name}`;
  } else {
    return "未知提交";
  }
  if (p.source === "collect" && p.contributor?.name) {
    base += `（采集自 ${p.contributor.name}${p.contributor.relation ? `·${p.contributor.relation}` : ""}）`;
  }
  return base;
}

/**
 * 应用 payload。调用方需先确认审核者权限（此函数不查权限）。
 * 返回 { applied: number }（0 表示目标已不存在，调用方据此自动拒绝）。
 */
export async function applyPayload(
  payload: SubmissionPayload,
  familyId: string,
): Promise<{ applied: number }> {
  if (payload.kind === "person-update") {
    const data: Prisma.PersonUpdateInput = {};
    const c = payload.changes;
    if (c.name !== undefined) data.name = c.name;
    if (c.alias !== undefined) data.alias = c.alias;
    if (c.birthOrder !== undefined) data.birthOrder = c.birthOrder;
    if (c.status !== undefined) data.status = c.status as LifeStatus;
    if (c.birthYear !== undefined) data.birthYear = c.birthYear;
    if (c.deathYear !== undefined) data.deathYear = c.deathYear;
    if (c.birthPlace !== undefined) data.birthPlace = c.birthPlace;
    if (c.biography !== undefined) data.biography = c.biography;
    if (c.note !== undefined) data.note = c.note;
    if (payload.contactPhoneHash !== undefined) data.contactPhoneHash = payload.contactPhoneHash;

    const result = await prisma.person.updateMany({
      where: { id: payload.personId, familyId, deletedAt: null },
      data,
    });
    return { applied: result.count };
  }

  if (payload.kind === "person-add-child") {
    const parent = await prisma.person.findFirst({
      where: { id: payload.parentId, familyId, deletedAt: null },
      select: { id: true, generation: true },
    });
    if (!parent) return { applied: 0 };

    const generation = parent.generation + 1;
    const genName = await prisma.generationName.findUnique({
      where: { familyId_generation: { familyId, generation } },
      select: { character: true },
    });
    const relation = payload.child.relation ?? "BIOLOGICAL";

    await prisma.$transaction(async (tx) => {
      const created = await tx.person.create({
        data: {
          familyId,
          name: payload.child.name,
          gender: payload.child.gender,
          generation,
          generationChar: genName?.character ?? null,
          birthOrder: payload.child.birthOrder ?? null,
          birthYear: payload.child.birthYear ?? null,
          birthPlace: payload.child.birthPlace ?? null,
          note: payload.child.note ?? null,
          isMarriedIn: false,
        },
      });
      await tx.parentChild.create({
        data: {
          familyId,
          parentId: parent.id,
          childId: created.id,
          relation,
          isPrimary: relation === "BIOLOGICAL",
          birthOrder: payload.child.birthOrder ?? null,
        },
      });
    });
    return { applied: 1 };
  }

  return { applied: 0 };
}

// ── 反序列化 ───────────────────────────────────────────────────────────

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
function parseSource(v: unknown): SubmissionSource | undefined {
  return v === "collect" || v === "member" ? v : undefined;
}
function parseContributor(v: unknown): Contributor | undefined {
  if (!v || typeof v !== "object") return undefined;
  const r = v as Record<string, unknown>;
  const out: Contributor = {};
  if (typeof r.name === "string") out.name = r.name.slice(0, 80);
  if (typeof r.phone === "string") out.phone = r.phone.slice(0, 40);
  if (typeof r.relation === "string") out.relation = r.relation.slice(0, 40);
  return Object.keys(out).length ? out : undefined;
}

/** 从 unknown 里安全反序列化 payload；失败返回 null。 */
export function parsePayload(raw: unknown): SubmissionPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (
    r.kind === "person-update" &&
    typeof r.personId === "string" &&
    typeof r.personName === "string" &&
    r.changes &&
    typeof r.changes === "object"
  ) {
    return {
      kind: "person-update",
      personId: r.personId,
      personName: r.personName,
      changes: r.changes as PersonUpdateChanges,
      source: parseSource(r.source),
      contributor: parseContributor(r.contributor),
      contactPhoneHash:
        typeof r.contactPhoneHash === "string"
          ? r.contactPhoneHash
          : r.contactPhoneHash === null
            ? null
            : undefined,
    };
  }

  if (
    r.kind === "person-add-child" &&
    typeof r.parentId === "string" &&
    typeof r.parentName === "string" &&
    r.child &&
    typeof r.child === "object"
  ) {
    const c = r.child as Record<string, unknown>;
    if (typeof c.name !== "string" || !c.name.trim()) return null;
    const gender = ["MALE", "FEMALE", "UNKNOWN"].includes(String(c.gender))
      ? (c.gender as Gender)
      : "UNKNOWN";
    const relation = ["BIOLOGICAL", "ADOPTED", "FOSTER", "STEP"].includes(String(c.relation))
      ? (c.relation as ParentRelation)
      : "BIOLOGICAL";
    return {
      kind: "person-add-child",
      parentId: r.parentId,
      parentName: r.parentName,
      child: {
        name: c.name.trim().slice(0, 100),
        gender,
        birthOrder: numOrNull(c.birthOrder),
        birthYear: numOrNull(c.birthYear),
        birthPlace: strOrNull(c.birthPlace),
        note: strOrNull(c.note),
        relation,
      },
      source: parseSource(r.source),
      contributor: parseContributor(r.contributor),
    };
  }

  return null;
}
