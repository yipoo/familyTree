/**
 * 家庭单元构造（详细图的语义单元）
 *
 * 一行 = "夫 + 妻（含原继）+ 子女姓名与排行 + 备注"
 * 输出按家族始祖向下的稳定顺序：父系优先、原配优先、长子在前。
 */

export interface PersonLite {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  generation: number;
  generationChar: string | null;
  status: string;
  isMarriedIn: boolean;
}

export interface MarriageLite {
  id: string;
  husbandId: string;
  wifeId: string;
  type: "PRIMARY" | "SECONDARY" | "CONCUBINE" | "UXORILOCAL" | string;
  order: number;
}

export interface ParentChildLite {
  parentId: string;
  childId: string;
  birthOrder: number | null;
}

export interface FamilyUnit {
  id: string; // = husband.id
  husband: PersonLite;
  wives: Array<{
    person: PersonLite;
    type: MarriageLite["type"];
    order: number;
  }>;
  children: Array<{
    person: PersonLite;
    birthOrder: number;
  }>;
  generation: number; // husband 所在世代
}

export function buildFamilyUnits(opts: {
  persons: PersonLite[];
  marriages: MarriageLite[];
  parentChild: ParentChildLite[];
}): FamilyUnit[] {
  const personById = new Map(opts.persons.map((p) => [p.id, p]));

  // 收集所有"父亲"（有婚姻 或 有子女且性别为男）
  const husbandIds = new Set<string>();
  for (const m of opts.marriages) husbandIds.add(m.husbandId);
  for (const pc of opts.parentChild) {
    const p = personById.get(pc.parentId);
    if (p && p.gender === "MALE") husbandIds.add(p.id);
  }

  // husbandId -> wives
  const wivesByHusband = new Map<string, FamilyUnit["wives"]>();
  for (const m of [...opts.marriages].sort((a, b) => a.order - b.order)) {
    const wife = personById.get(m.wifeId);
    if (!wife) continue;
    const arr = wivesByHusband.get(m.husbandId) ?? [];
    arr.push({ person: wife, type: m.type, order: m.order });
    wivesByHusband.set(m.husbandId, arr);
  }

  // parentId(=父) -> children
  const childrenByFather = new Map<string, FamilyUnit["children"]>();
  for (const pc of opts.parentChild) {
    const father = personById.get(pc.parentId);
    if (!father || father.gender !== "MALE") continue;
    const child = personById.get(pc.childId);
    if (!child) continue;
    const arr = childrenByFather.get(father.id) ?? [];
    if (!arr.some((c) => c.person.id === child.id)) {
      arr.push({ person: child, birthOrder: pc.birthOrder ?? 0 });
    }
    childrenByFather.set(father.id, arr);
  }
  for (const arr of childrenByFather.values()) {
    arr.sort((a, b) => a.birthOrder - b.birthOrder);
  }

  const units: FamilyUnit[] = [];
  for (const hid of husbandIds) {
    const husband = personById.get(hid);
    if (!husband) continue;
    const wives = wivesByHusband.get(hid) ?? [];
    const children = childrenByFather.get(hid) ?? [];
    if (wives.length === 0 && children.length === 0) continue;
    units.push({
      id: hid,
      husband,
      wives,
      children,
      generation: husband.generation,
    });
  }

  // 排序：先按世代升序，同世代内按 husband 名称（稳定）
  units.sort(
    (a, b) =>
      a.generation - b.generation ||
      a.husband.name.localeCompare(b.husband.name, "zh-Hans-CN"),
  );

  return units;
}
