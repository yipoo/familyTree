/**
 * 数据体检 / 智能纠错（纯算法）
 *
 * 对全族数据做一致性检查，产出问题清单供族长 / 管理员核对修订。覆盖修谱常见错误：
 *   - 生卒矛盾（卒早于生、年份越界、享年过高）
 *   - 父子年龄倒挂 / 生育年龄过小
 *   - 世代与父母不连续
 *   - 同辈同名 / 疑似重复人物
 *   - 父母数量异常（多于一父 / 一母）
 *   - 自环、婚配双方相同
 *   - 关键字段缺失（性别不详）
 *
 * 纯函数，便于单测；阈值经 opts 可调。currentYear 由调用方传入以保证可测。
 */

export type CheckLevel = "error" | "warning" | "info";

export interface CheckPerson {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  generation: number;
  birthYear?: number | null;
  deathYear?: number | null;
}

export interface CheckParentChild {
  parentId: string;
  childId: string;
  relation?: "BIOLOGICAL" | "ADOPTED" | "FOSTER" | "STEP";
}

export interface CheckMarriage {
  husbandId: string;
  wifeId: string;
}

export interface DataIssue {
  level: CheckLevel;
  code: string;
  message: string;
  personIds: string[];
}

export interface DataCheckResult {
  issues: DataIssue[];
  counts: Record<CheckLevel, number>;
  checked: number;
}

export interface CheckOptions {
  currentYear: number;
  /** 最小生育年龄（父母与子女出生年之差低于此值告警） */
  minParentingAge?: number;
  /** 享年上限告警 */
  maxAge?: number;
  /** 最早可信年份（早于此值视为越界） */
  minYear?: number;
}

export function checkFamilyData(
  input: {
    persons: CheckPerson[];
    parentChild: CheckParentChild[];
    marriages: CheckMarriage[];
  },
  opts: CheckOptions,
): DataCheckResult {
  const minParentingAge = opts.minParentingAge ?? 13;
  const maxAge = opts.maxAge ?? 120;
  const minYear = opts.minYear ?? 1;
  const cy = opts.currentYear;

  const byId = new Map(input.persons.map((p) => [p.id, p]));
  const issues: DataIssue[] = [];
  const push = (level: CheckLevel, code: string, message: string, personIds: string[]) =>
    issues.push({ level, code, message, personIds });

  const nm = (id: string) => byId.get(id)?.name ?? "(未知)";

  // ── 单人：生卒 / 字段 ──
  for (const p of input.persons) {
    if (p.birthYear != null && (p.birthYear < minYear || p.birthYear > cy)) {
      push("error", "BIRTH_YEAR_RANGE", `${p.name}：出生年 ${p.birthYear} 不合理`, [p.id]);
    }
    if (p.deathYear != null && (p.deathYear < minYear || p.deathYear > cy)) {
      push("error", "DEATH_YEAR_RANGE", `${p.name}：卒年 ${p.deathYear} 不合理`, [p.id]);
    }
    if (p.birthYear != null && p.deathYear != null) {
      if (p.deathYear < p.birthYear) {
        push("error", "DEATH_BEFORE_BIRTH", `${p.name}：卒年 ${p.deathYear} 早于生年 ${p.birthYear}`, [p.id]);
      } else if (p.deathYear - p.birthYear > maxAge) {
        push("warning", "AGE_TOO_HIGH", `${p.name}：享年 ${p.deathYear - p.birthYear} 岁，请核对`, [p.id]);
      }
    }
    if (p.gender === "UNKNOWN") {
      push("info", "GENDER_UNKNOWN", `${p.name}：性别不详`, [p.id]);
    }
  }

  // ── 亲子边：年龄倒挂 / 世代 / 自环 / 父母计数 ──
  const maleParentsOf = new Map<string, string[]>();
  const femaleParentsOf = new Map<string, string[]>();
  for (const pc of input.parentChild) {
    if (pc.parentId === pc.childId) {
      push("error", "SELF_PARENT", `${nm(pc.parentId)}：自己是自己的父母`, [pc.parentId]);
      continue;
    }
    const parent = byId.get(pc.parentId);
    const child = byId.get(pc.childId);
    if (!parent || !child) continue;

    // 父母计数（仅生物学关系参与"多于一父/一母"判定，过继除外）
    if ((pc.relation ?? "BIOLOGICAL") === "BIOLOGICAL") {
      if (parent.gender === "MALE") {
        (maleParentsOf.get(child.id) ?? maleParentsOf.set(child.id, []).get(child.id)!).push(parent.id);
      } else if (parent.gender === "FEMALE") {
        (femaleParentsOf.get(child.id) ?? femaleParentsOf.set(child.id, []).get(child.id)!).push(parent.id);
      }
    }

    // 年龄倒挂 / 生育年龄
    if (parent.birthYear != null && child.birthYear != null) {
      const diff = child.birthYear - parent.birthYear;
      if (diff <= 0) {
        push("error", "PARENT_NOT_OLDER", `${child.name}（${child.birthYear}）出生不晚于父母 ${parent.name}（${parent.birthYear}）`, [parent.id, child.id]);
      } else if (diff < minParentingAge && (pc.relation ?? "BIOLOGICAL") === "BIOLOGICAL") {
        push("warning", "PARENTING_TOO_YOUNG", `${parent.name} 生育 ${child.name} 时仅约 ${diff} 岁`, [parent.id, child.id]);
      }
    }

    // 世代连续（仅生物学/过继按 +1 期望；继亲 STEP 跳过）
    if (
      (pc.relation ?? "BIOLOGICAL") !== "STEP" &&
      child.generation !== parent.generation + 1
    ) {
      push("warning", "GENERATION_GAP", `${child.name}（第${child.generation}世）与父母 ${parent.name}（第${parent.generation}世）世代不连续`, [parent.id, child.id]);
    }
  }

  for (const [childId, dads] of maleParentsOf) {
    if (dads.length > 1) {
      push("warning", "MULTIPLE_FATHERS", `${nm(childId)}：登记了 ${dads.length} 个生父`, [childId, ...dads]);
    }
  }
  for (const [childId, moms] of femaleParentsOf) {
    if (moms.length > 1) {
      push("warning", "MULTIPLE_MOTHERS", `${nm(childId)}：登记了 ${moms.length} 个生母`, [childId, ...moms]);
    }
  }

  // ── 婚配 ──
  for (const m of input.marriages) {
    if (m.husbandId === m.wifeId) {
      push("error", "SELF_MARRIAGE", `${nm(m.husbandId)}：与自己婚配`, [m.husbandId]);
    }
  }

  // ── 同辈同名 / 疑似重复 ──
  const byNameGen = new Map<string, CheckPerson[]>();
  for (const p of input.persons) {
    const key = `${p.name}@@${p.generation}`;
    (byNameGen.get(key) ?? byNameGen.set(key, []).get(key)!).push(p);
  }
  for (const group of byNameGen.values()) {
    if (group.length < 2) continue;
    // 同名同生年 → 疑似重复（error）；否则同辈同名（warning）
    const byBirth = new Map<number, CheckPerson[]>();
    let sameBirthFlagged = false;
    for (const p of group) {
      if (p.birthYear == null) continue;
      (byBirth.get(p.birthYear) ?? byBirth.set(p.birthYear, []).get(p.birthYear)!).push(p);
    }
    for (const same of byBirth.values()) {
      if (same.length > 1) {
        sameBirthFlagged = true;
        push("error", "DUPLICATE_PERSON", `疑似重复：${same[0].name}（第${same[0].generation}世，生于${same[0].birthYear}）共 ${same.length} 条`, same.map((p) => p.id));
      }
    }
    if (!sameBirthFlagged) {
      push("warning", "SAME_NAME_GENERATION", `同辈同名：${group[0].name}（第${group[0].generation}世）共 ${group.length} 人`, group.map((p) => p.id));
    }
  }

  const counts: Record<CheckLevel, number> = { error: 0, warning: 0, info: 0 };
  for (const i of issues) counts[i.level]++;

  // 稳定排序：error → warning → info
  const order: Record<CheckLevel, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => order[a.level] - order[b.level]);

  return { issues, counts, checked: input.persons.length };
}
