/**
 * 居住地继承解析
 *
 * 规则：
 *   - 自己有 residenceId → 用自己的
 *   - 嫁入女性（isMarriedIn）→ 跟夫（marriagesAsWife[0].husband）
 *   - 否则沿 ParentChild.isPrimary=true 的父亲（gender=MALE）上溯
 *   - 上溯到根仍无 → null（未知）
 *
 * 过继：上溯走 isPrimary，所以过继到 C 后跟 C 走，与权限规则一致。
 */
import { prisma } from "@/lib/db";

const MAX_DEPTH = 64;

type Resolver = {
  residenceById: Map<string, string | null>;
  isMarriedInById: Map<string, boolean>;
  husbandIdByWifeId: Map<string, string>;
  fatherIdByChildId: Map<string, string>;
};

/**
 * 单人解析（DB 拉取链上数据）。低频场景使用。
 */
export async function resolveResidence(personId: string): Promise<string | null> {
  let cur: string | null = personId;
  const seen = new Set<string>();
  let depth = 0;
  while (cur && !seen.has(cur) && depth < MAX_DEPTH) {
    seen.add(cur);
    const p: {
      residenceId: string | null;
      isMarriedIn: boolean;
      marriagesAsWife: { husbandId: string }[];
    } | null = await prisma.person.findUnique({
      where: { id: cur },
      select: {
        residenceId: true,
        isMarriedIn: true,
        marriagesAsWife: {
          orderBy: { order: "asc" },
          take: 1,
          select: { husbandId: true },
        },
      },
    });
    if (!p) return null;
    if (p.residenceId) return p.residenceId;

    if (p.isMarriedIn) {
      cur = p.marriagesAsWife[0]?.husbandId ?? null;
    } else {
      const pc: { parentId: string } | null = await prisma.parentChild.findFirst({
        where: { childId: cur, isPrimary: true, parent: { gender: "MALE" } },
        select: { parentId: true },
      });
      cur = pc?.parentId ?? null;
    }
    depth++;
  }
  return null;
}

/**
 * 批量解析：树渲染等场景。从家族全量 person + 关系建索引，O(N) + O(depth) per lookup。
 */
export async function buildResidenceResolver(familyId: string): Promise<Resolver> {
  const [persons, marriages, parentChild] = await Promise.all([
    prisma.person.findMany({
      where: { familyId, deletedAt: null },
      select: { id: true, residenceId: true, isMarriedIn: true, gender: true },
    }),
    prisma.marriage.findMany({
      where: { familyId },
      orderBy: { order: "asc" },
      select: { husbandId: true, wifeId: true },
    }),
    prisma.parentChild.findMany({
      where: { familyId, isPrimary: true },
      select: { parentId: true, childId: true },
    }),
  ]);

  const genderById = new Map(persons.map((p) => [p.id, p.gender]));
  const residenceById = new Map<string, string | null>();
  const isMarriedInById = new Map<string, boolean>();
  for (const p of persons) {
    residenceById.set(p.id, p.residenceId);
    isMarriedInById.set(p.id, p.isMarriedIn);
  }

  const husbandIdByWifeId = new Map<string, string>();
  for (const m of marriages) {
    if (!husbandIdByWifeId.has(m.wifeId)) {
      husbandIdByWifeId.set(m.wifeId, m.husbandId);
    }
  }

  const fatherIdByChildId = new Map<string, string>();
  for (const pc of parentChild) {
    if (genderById.get(pc.parentId) !== "MALE") continue;
    if (!fatherIdByChildId.has(pc.childId)) {
      fatherIdByChildId.set(pc.childId, pc.parentId);
    }
  }

  return { residenceById, isMarriedInById, husbandIdByWifeId, fatherIdByChildId };
}

export function resolveFromIndex(
  resolver: Resolver,
  personId: string,
): string | null {
  let cur: string | null = personId;
  const seen = new Set<string>();
  let depth = 0;
  while (cur && !seen.has(cur) && depth < MAX_DEPTH) {
    seen.add(cur);
    const own = resolver.residenceById.get(cur);
    if (own) return own;
    if (resolver.isMarriedInById.get(cur)) {
      cur = resolver.husbandIdByWifeId.get(cur) ?? null;
    } else {
      cur = resolver.fatherIdByChildId.get(cur) ?? null;
    }
    depth++;
  }
  return null;
}

export type ResolvedResidence = {
  locationId: string | null;
  /** 解析最终命中的人物 id；自己 = personId 自身；继承 = 祖先 id；null = 未找到 */
  fromPersonId: string | null;
};

/** 与上面一样但同时返回继承来源，便于 UI 标注「继承自 X」。 */
export function resolveWithSource(
  resolver: Resolver,
  personId: string,
): ResolvedResidence {
  let cur: string | null = personId;
  const seen = new Set<string>();
  let depth = 0;
  while (cur && !seen.has(cur) && depth < MAX_DEPTH) {
    seen.add(cur);
    const own = resolver.residenceById.get(cur);
    if (own) return { locationId: own, fromPersonId: cur };
    if (resolver.isMarriedInById.get(cur)) {
      cur = resolver.husbandIdByWifeId.get(cur) ?? null;
    } else {
      cur = resolver.fatherIdByChildId.get(cur) ?? null;
    }
    depth++;
  }
  return { locationId: null, fromPersonId: null };
}

