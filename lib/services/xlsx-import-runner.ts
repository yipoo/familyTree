/**
 * 把解析后的 Excel 数据写入家族（按 externalId 做 upsert）。
 *
 * 写入策略（不破坏已有 hand-edit 数据）：
 *   - Person：以 (familyId, externalId) 为唯一键 upsert
 *   - 同步推导字辈表（已存在的字辈条目不覆盖）
 *   - ParentChild：以 (parentId, childId, BIOLOGICAL) 唯一键 upsert
 *   - Marriage：以 (familyId, husbandId, wifeId) 去重；缺失则建
 *
 * 不删除已存在但本次未引用的记录（Excel 仅做"补录"，不做镜像同步）。
 *
 * 返回统计信息供前端展示。
 */
import { prisma } from "@/lib/db";
import {
  type Gender,
  type LifeStatus,
  MarriageType,
  ParentRelation,
} from "@/lib/generated/prisma/enums";
import type { XlsxParseResult, XlsxRawPerson } from "@/lib/services/xlsx-import";

export interface ImportStats {
  personsCreated: number;
  personsUpdated: number;
  generationCharsAdded: number;
  parentChildCreated: number;
  marriagesCreated: number;
  synthesizedMothers: number;
  missingParents: number;
  issues: string[];
}

const BATCH = 500;

export async function runImport(
  familyId: string,
  parsed: XlsxParseResult,
): Promise<ImportStats> {
  const stats: ImportStats = {
    personsCreated: 0,
    personsUpdated: 0,
    generationCharsAdded: 0,
    parentChildCreated: 0,
    marriagesCreated: 0,
    synthesizedMothers: 0,
    missingParents: 0,
    issues: [...parsed.issues],
  };

  // ---- 字辈表：从 generationCharCounts 取每代最常见字符；存在的不覆盖 ----
  const existingGen = await prisma.generationName.findMany({
    where: { familyId },
    select: { generation: true },
  });
  const existingGenSet = new Set(existingGen.map((g) => g.generation));
  const newGenRows: { familyId: string; generation: number; character: string }[] = [];
  for (const [gen, counts] of parsed.generationCharCounts) {
    if (existingGenSet.has(gen)) continue;
    let best = "";
    let bestN = 0;
    for (const [ch, n] of counts) {
      if (n > bestN) {
        best = ch;
        bestN = n;
      }
    }
    if (best) newGenRows.push({ familyId, generation: gen, character: best });
  }
  if (newGenRows.length > 0) {
    await prisma.generationName.createMany({ data: newGenRows, skipDuplicates: true });
    stats.generationCharsAdded = newGenRows.length;
  }

  // ---- 合成嫁入母亲（被引用但未在表中的 motherId） ----
  const presentIds = new Set(parsed.rows.map((r) => r.externalId));
  const synthMothers = new Map<string, { name: string; generation: number }>();
  for (const r of parsed.rows) {
    if (!r.motherExternalId) continue;
    if (presentIds.has(r.motherExternalId)) continue;
    const motherGen = Math.max(1, r.generation - 1);
    const exist = synthMothers.get(r.motherExternalId);
    if (!exist) {
      synthMothers.set(r.motherExternalId, {
        name: r.motherName || "(佚名氏)",
        generation: motherGen,
      });
    } else if (motherGen < exist.generation) {
      exist.generation = motherGen;
    }
  }
  stats.synthesizedMothers = synthMothers.size;

  // ---- Person upsert（按 externalId）----
  // 先查一下哪些 externalId 已存在 → 决定 created / updated
  const allExtIds = [
    ...parsed.rows.map((r) => r.externalId),
    ...synthMothers.keys(),
  ];
  const existingPersons = await prisma.person.findMany({
    where: { familyId, externalId: { in: allExtIds } },
    select: { id: true, externalId: true },
  });
  const idByExt = new Map(
    existingPersons
      .filter((p): p is { id: string; externalId: string } => !!p.externalId)
      .map((p) => [p.externalId, p.id]),
  );

  // 批量 create / update
  for (const r of parsed.rows) {
    const data = {
      name: r.givenName?.trim() || `${r.surname}${r.givenName}`.trim() || `(无名#${r.externalId})`,
      alias: r.alias || null,
      gender: r.gender as Gender,
      generation: r.generation,
      generationChar: r.generationChar || null,
      birthOrder: r.birthOrder,
      birthDate: r.birthDate || null,
      birthPlace: r.birthPlace || null,
      status: r.status as LifeStatus,
      succession: r.succession || null,
      paperRecord: r.paperRecord || null,
      noteHint: r.noteHint || null,
      biography: r.biography || null,
    };
    const exId = idByExt.get(r.externalId);
    if (exId) {
      await prisma.person.update({ where: { id: exId }, data });
      stats.personsUpdated++;
    } else {
      const created = await prisma.person.create({
        data: {
          familyId,
          externalId: r.externalId,
          isMarriedIn: false,
          ...data,
        },
      });
      idByExt.set(r.externalId, created.id);
      stats.personsCreated++;
    }
  }

  for (const [extId, m] of synthMothers) {
    if (idByExt.has(extId)) continue;
    const created = await prisma.person.create({
      data: {
        familyId,
        externalId: extId,
        name: m.name,
        gender: "FEMALE",
        generation: m.generation,
        isMarriedIn: true,
        surnameOnly: /^[一-鿿]氏$/.test(m.name),
        status: "UNKNOWN",
      },
    });
    idByExt.set(extId, created.id);
    stats.personsCreated++;
  }

  // ---- ParentChild ----
  const pcData: {
    familyId: string;
    parentId: string;
    childId: string;
    relation: ParentRelation;
    birthOrder: number | null;
    isPrimary: boolean;
  }[] = [];
  for (const r of parsed.rows) {
    const childId = idByExt.get(r.externalId);
    if (!childId) continue;
    if (r.fatherExternalId) {
      const parentId = idByExt.get(r.fatherExternalId);
      if (parentId) {
        pcData.push({
          familyId,
          parentId,
          childId,
          relation: ParentRelation.BIOLOGICAL,
          birthOrder: r.birthOrder,
          isPrimary: true,
        });
      } else {
        stats.missingParents++;
      }
    }
    if (r.motherExternalId) {
      const parentId = idByExt.get(r.motherExternalId);
      if (parentId) {
        pcData.push({
          familyId,
          parentId,
          childId,
          relation: ParentRelation.BIOLOGICAL,
          birthOrder: r.birthOrder,
          isPrimary: true,
        });
      } else {
        stats.missingParents++;
      }
    }
  }
  // dedup
  const pcKey = (x: { parentId: string; childId: string; relation: ParentRelation }) =>
    `${x.parentId}::${x.childId}::${x.relation}`;
  const pcDedup = Array.from(new Map(pcData.map((x) => [pcKey(x), x])).values());
  for (let i = 0; i < pcDedup.length; i += BATCH) {
    const slice = pcDedup.slice(i, i + BATCH);
    const before = await prisma.parentChild.count({ where: { familyId } });
    await prisma.parentChild.createMany({ data: slice, skipDuplicates: true });
    const after = await prisma.parentChild.count({ where: { familyId } });
    stats.parentChildCreated += after - before;
  }

  // ---- Marriage（从 fatherId+motherId 对推导） ----
  const marriageKeys = new Set<string>();
  const marriagesNew: {
    familyId: string;
    husbandId: string;
    wifeId: string;
    type: MarriageType;
    order: number;
  }[] = [];
  // 已存在的婚姻 dedup
  const existingMarriages = await prisma.marriage.findMany({
    where: { familyId },
    select: { husbandId: true, wifeId: true },
  });
  for (const m of existingMarriages) {
    marriageKeys.add(`${m.husbandId}::${m.wifeId}`);
  }
  const husbandWifeCount = new Map<string, number>();
  for (const m of existingMarriages) {
    husbandWifeCount.set(m.husbandId, (husbandWifeCount.get(m.husbandId) ?? 0) + 1);
  }
  for (const r of parsed.rows) {
    if (!r.fatherExternalId || !r.motherExternalId) continue;
    const husbandId = idByExt.get(r.fatherExternalId);
    const wifeId = idByExt.get(r.motherExternalId);
    if (!husbandId || !wifeId) continue;
    const k = `${husbandId}::${wifeId}`;
    if (marriageKeys.has(k)) continue;
    marriageKeys.add(k);
    const order = (husbandWifeCount.get(husbandId) ?? 0) + 1;
    husbandWifeCount.set(husbandId, order);
    marriagesNew.push({
      familyId,
      husbandId,
      wifeId,
      type: order === 1 ? MarriageType.PRIMARY : MarriageType.SECONDARY,
      order,
    });
  }
  if (marriagesNew.length > 0) {
    await prisma.marriage.createMany({ data: marriagesNew });
    stats.marriagesCreated = marriagesNew.length;
  }

  return stats;
}

/**
 * "干跑"：仅返回将要发生的统计预估，不写库。
 */
export async function dryRunImport(
  familyId: string,
  parsed: XlsxParseResult,
): Promise<Pick<ImportStats, "personsCreated" | "personsUpdated" | "synthesizedMothers" | "issues">> {
  const presentIds = new Set(parsed.rows.map((r) => r.externalId));
  const synthCount = new Set<string>();
  for (const r of parsed.rows) {
    if (r.motherExternalId && !presentIds.has(r.motherExternalId)) {
      synthCount.add(r.motherExternalId);
    }
  }
  const allExtIds = [...presentIds, ...synthCount];
  const existing = await prisma.person.findMany({
    where: { familyId, externalId: { in: allExtIds } },
    select: { externalId: true },
  });
  const existingSet = new Set(
    existing
      .map((p) => p.externalId)
      .filter((x): x is string => !!x),
  );

  let updated = 0;
  let created = 0;
  for (const id of allExtIds) {
    if (existingSet.has(id)) updated++;
    else created++;
  }
  return {
    personsCreated: created,
    personsUpdated: updated,
    synthesizedMothers: synthCount.size,
    issues: parsed.issues,
  };
}
