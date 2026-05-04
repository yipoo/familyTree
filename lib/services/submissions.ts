/**
 * 提交（PendingSubmission）payload 设计与应用
 *
 * 一期支持 person-update：编辑某人物的字段。
 * 后续可扩展：person-create / person-delete / parents-change / residence-set 等。
 */
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { LifeStatus } from "@/lib/generated/prisma/enums";

export type SubmissionPayload =
  | {
      kind: "person-update";
      personId: string;
      personName: string; // 冗余存储便于审核界面展示
      changes: PersonUpdateChanges;
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
  if (p.kind === "person-update") {
    const keys = Object.keys(p.changes);
    return `修改 ${p.personName} 的 ${keys.length} 个字段：${keys.join("、")}`;
  }
  return "未知提交";
}

/**
 * 应用 payload。调用方需先确认审核者权限（此函数不查权限）。
 * 返回 { applied: number } 或抛错。
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

    const result = await prisma.person.updateMany({
      where: { id: payload.personId, familyId, deletedAt: null },
      data,
    });
    return { applied: result.count };
  }
  return { applied: 0 };
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
    };
  }
  return null;
}

