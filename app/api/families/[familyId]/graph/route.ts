import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  layoutPaternalTree,
  isSpacingPreset,
  DEFAULT_SPACING,
} from "@/lib/services/tree-layout";
import { parseLineage } from "@/lib/services/lineage";
import { authErrorResponse, requireFamilyRole } from "@/lib/auth/guard";

/**
 * GET /api/families/[familyId]/graph?root=&focus=&upGen=3&lineage=paternal|maternal|all
 *
 * 返回完整树谱布局：节点（含坐标）+ 边 + 世代轴信息 + 统计。
 *
 * 模式（互斥）：
 *   - 默认：从家族首支根开始，展示全部
 *   - root=PID：以 PID 为布局根，展示其所有子孙（"仅看此分支"）
 *   - focus=PID&upGen=N：以 PID 向上 N 代直系祖先 + PID 全部后代为子集
 *     上行只保留直系（兄弟、堂亲不显示），下行保留全部。
 *     默认 upGen=3。
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ familyId: string }> },
) {
  const { familyId } = await ctx.params;
  try {
    await requireFamilyRole(familyId, "MEMBER");
  } catch (e) {
    return authErrorResponse(e);
  }
  const url = new URL(req.url);
  const rootParam = url.searchParams.get("root");
  const focusParam = url.searchParams.get("focus");
  const upGenRaw = Number(url.searchParams.get("upGen") ?? "3");
  const upGen = Number.isFinite(upGenRaw) && upGenRaw >= 0 ? Math.min(upGenRaw, 10) : 3;
  const lineage = parseLineage(url.searchParams.get("lineage") ?? undefined);
  const spacingRaw = url.searchParams.get("spacing");
  const spacing = isSpacingPreset(spacingRaw) ? spacingRaw : DEFAULT_SPACING;

  const [family, persons, marriages, parentChild] = await Promise.all([
    prisma.family.findUnique({
      where: { id: familyId },
      include: {
        generationNames: { orderBy: { generation: "asc" } },
        branches: { orderBy: { name: "asc" }, include: { rootPerson: true } },
      },
    }),
    prisma.person.findMany({
      where: { familyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        alias: true,
        gender: true,
        generation: true,
        generationChar: true,
        birthOrder: true,
        isMarriedIn: true,
        status: true,
        residenceId: true,
      },
    }),
    prisma.marriage.findMany({
      where: { familyId },
      select: { id: true, husbandId: true, wifeId: true, type: true, order: true },
    }),
    prisma.parentChild.findMany({
      where: { familyId },
      select: { parentId: true, childId: true, birthOrder: true },
    }),
  ]);
  if (!family) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Family not found" } },
      { status: 404 },
    );
  }

  // ---------- 关系映射 ----------
  const personById = new Map(persons.map((p) => [p.id, p]));
  // childId -> father（仅父系直系）
  const fatherOf = new Map<string, string>();
  for (const pc of parentChild) {
    const parent = personById.get(pc.parentId);
    if (!parent || parent.gender !== "MALE") continue;
    if (!fatherOf.has(pc.childId)) fatherOf.set(pc.childId, pc.parentId);
  }
  // fatherId -> children
  const childrenOf = new Map<string, string[]>();
  for (const pc of parentChild) {
    const parent = personById.get(pc.parentId);
    if (!parent || parent.gender !== "MALE") continue;
    const arr = childrenOf.get(pc.parentId) ?? [];
    if (!arr.includes(pc.childId)) arr.push(pc.childId);
    childrenOf.set(pc.parentId, arr);
  }
  // husbandId -> wives
  const wivesOf = new Map<string, string[]>();
  for (const m of marriages) {
    const arr = wivesOf.get(m.husbandId) ?? [];
    if (!arr.includes(m.wifeId)) arr.push(m.wifeId);
    wivesOf.set(m.husbandId, arr);
  }

  // ---------- 选根 ----------
  let rootPersonId: string | null = null;
  let rootPersonName = "";
  let branchInfo: { name: string; rootName: string } | null = null;
  // 用于 focus 模式：直系祖先链（focus → father → ... 顶部 N 代）
  let ancestorChain: string[] | null = null;

  if (focusParam && personById.has(focusParam)) {
    // focus 模式：找直系祖先（最多 upGen 代）
    const chain: string[] = [focusParam];
    let cur = focusParam;
    for (let i = 0; i < upGen; i++) {
      const f = fatherOf.get(cur);
      if (!f) break;
      chain.push(f);
      cur = f;
    }
    ancestorChain = chain;
    rootPersonId = chain[chain.length - 1]; // 最顶端祖先
    rootPersonName = personById.get(rootPersonId)!.name;
  } else if (rootParam) {
    const p = personById.get(rootParam);
    if (p) {
      rootPersonId = p.id;
      rootPersonName = p.name;
    }
  }
  if (!rootPersonId) {
    const branch = family.branches[0];
    if (branch?.rootPerson) {
      rootPersonId = branch.rootPerson.id;
      rootPersonName = branch.rootPerson.name;
      branchInfo = { name: branch.name, rootName: branch.rootPerson.name };
    }
  }
  if (!rootPersonId) {
    const minGen = persons.reduce(
      (m, p) => Math.min(m, p.generation),
      Number.POSITIVE_INFINITY,
    );
    const candidate =
      persons.find((p) => p.generation === minGen && p.gender === "MALE") ??
      persons.find((p) => p.generation === minGen);
    if (candidate) {
      rootPersonId = candidate.id;
      rootPersonName = candidate.name;
    }
  }

  // ---------- 子集过滤 ----------
  // lineage 过滤通用规则
  const personLineageOK = (p: (typeof persons)[number]) => {
    if (lineage === "all") return true;
    if (lineage === "paternal") return p.gender === "MALE" || p.isMarriedIn;
    return p.gender === "FEMALE";
  };

  // 计算允许的 person ids 与允许的 parentChild 边
  const allowedIds = new Set<string>();
  const allowedPC = new Set<string>(); // 用 `${parentId}::${childId}` 标识
  const pcKey = (pid: string, cid: string) => `${pid}::${cid}`;

  if (focusParam && ancestorChain) {
    // focus 模式：
    //   - 祖先链上每代仅保留与下一代的父子边（不含旁支兄弟）
    //   - focus 及其后代：完整保留
    //   - 加入所有相关人物的配偶
    const focusId = focusParam;

    // BFS 收集 focus 的所有后代
    const descendants: string[] = [];
    const queue = [focusId];
    while (queue.length) {
      const cur = queue.shift()!;
      const kids = childrenOf.get(cur) ?? [];
      for (const k of kids) {
        descendants.push(k);
        queue.push(k);
      }
    }

    // 加入祖先链 + 后代
    for (const a of ancestorChain) allowedIds.add(a);
    for (const d of descendants) allowedIds.add(d);

    // 加入配偶（加入到 allowedIds，但不再下钻）
    for (const id of [...ancestorChain, ...descendants]) {
      const wives = wivesOf.get(id) ?? [];
      for (const w of wives) allowedIds.add(w);
    }

    // ParentChild 边筛选：
    //   - 祖先链单线：A_top → A_mid → A_low → focus
    for (let i = ancestorChain.length - 1; i >= 1; i--) {
      const parent = ancestorChain[i];
      const child = ancestorChain[i - 1];
      // 父→子（父系）
      allowedPC.add(pcKey(parent, child));
      // 母→子（如有母亲且在 allowedIds 中）
      const motherPCs = parentChild.filter(
        (pc) => pc.childId === child && personById.get(pc.parentId)?.gender === "FEMALE",
      );
      for (const mpc of motherPCs) {
        if (allowedIds.has(mpc.parentId)) {
          allowedPC.add(pcKey(mpc.parentId, mpc.childId));
        }
      }
    }
    //   - focus 及后代：所有父→子边
    for (const id of [focusId, ...descendants]) {
      // 该人作为父亲的边
      for (const k of childrenOf.get(id) ?? []) {
        allowedPC.add(pcKey(id, k));
      }
      // 该人作为子女的边（母亲 → 自己）
      const motherPCs = parentChild.filter(
        (pc) => pc.childId === id && personById.get(pc.parentId)?.gender === "FEMALE",
      );
      for (const mpc of motherPCs) {
        if (allowedIds.has(mpc.parentId)) {
          allowedPC.add(pcKey(mpc.parentId, mpc.childId));
        }
      }
    }
  } else {
    // 默认 / root 模式：按 lineage 全部保留
    for (const p of persons) {
      if (personLineageOK(p)) allowedIds.add(p.id);
    }
    for (const pc of parentChild) {
      if (allowedIds.has(pc.parentId) && allowedIds.has(pc.childId)) {
        allowedPC.add(pcKey(pc.parentId, pc.childId));
      }
    }
  }

  const filteredPersons = persons.filter((p) => allowedIds.has(p.id));
  const filteredMarriages = marriages.filter(
    (m) => allowedIds.has(m.husbandId) && allowedIds.has(m.wifeId),
  );
  const filteredParentChild = parentChild.filter((pc) =>
    allowedPC.has(pcKey(pc.parentId, pc.childId)),
  );

  const stats = {
    total: filteredPersons.length,
    male: filteredPersons.filter((p) => p.gender === "MALE").length,
    female: filteredPersons.filter((p) => p.gender === "FEMALE").length,
  };

  let layout: ReturnType<typeof layoutPaternalTree> | null = null;
  if (rootPersonId && allowedIds.has(rootPersonId)) {
    layout = layoutPaternalTree({
      rootPersonId,
      persons: filteredPersons,
      marriages: filteredMarriages,
      parentChild: filteredParentChild,
      spacing,
    });
  }

  const generationChars = Object.fromEntries(
    family.generationNames.map((g) => [g.generation, g.character]),
  );

  // ---------- 居住地批量解析 ----------
  // 从全量 persons + marriages + parentChild 建索引（不限于 filtered，因为继承可能跨过被隐藏的祖先）
  const residenceById = new Map<string, string | null>();
  const isMarriedInById = new Map<string, boolean>();
  const husbandIdByWifeId = new Map<string, string>();
  const fatherIdByChildId = new Map<string, string>();
  for (const p of persons) {
    residenceById.set(p.id, p.residenceId);
    isMarriedInById.set(p.id, p.isMarriedIn);
  }
  for (const m of [...marriages].sort((a, b) => a.order - b.order)) {
    if (!husbandIdByWifeId.has(m.wifeId)) {
      husbandIdByWifeId.set(m.wifeId, m.husbandId);
    }
  }
  for (const pc of parentChild) {
    if (personById.get(pc.parentId)?.gender !== "MALE") continue;
    if (!fatherIdByChildId.has(pc.childId)) {
      fatherIdByChildId.set(pc.childId, pc.parentId);
    }
  }

  function resolveResidence(
    personId: string,
  ): { locationId: string | null; fromPersonId: string | null } {
    let cur: string | null = personId;
    const seen = new Set<string>();
    let depth = 0;
    while (cur && !seen.has(cur) && depth < 64) {
      seen.add(cur);
      const own = residenceById.get(cur);
      if (own) return { locationId: own, fromPersonId: cur };
      cur = isMarriedInById.get(cur)
        ? husbandIdByWifeId.get(cur) ?? null
        : fatherIdByChildId.get(cur) ?? null;
      depth++;
    }
    return { locationId: null, fromPersonId: null };
  }

  // 解析 filtered 集合
  const resolved: Array<{
    personId: string;
    locationId: string | null;
    fromPersonId: string | null;
  }> = filteredPersons.map((p) => ({ personId: p.id, ...resolveResidence(p.id) }));

  const usedLocationIds = [
    ...new Set(resolved.map((r) => r.locationId).filter((x): x is string => !!x)),
  ];
  const locations = usedLocationIds.length
    ? await prisma.location.findMany({
        where: { id: { in: usedLocationIds } },
        select: { id: true, fullText: true, village: true, town: true, county: true },
      })
    : [];
  const locById = new Map(locations.map((l) => [l.id, l]));

  const residenceByPersonId: Record<
    string,
    {
      locationId: string;
      fullText: string;
      short: string;
      fromPersonId: string;
      inherited: boolean;
    }
  > = {};
  for (const r of resolved) {
    if (!r.locationId || !r.fromPersonId) continue;
    const l = locById.get(r.locationId);
    if (!l) continue;
    residenceByPersonId[r.personId] = {
      locationId: l.id,
      fullText: l.fullText,
      short: l.village || l.town || l.county || l.fullText,
      fromPersonId: r.fromPersonId,
      inherited: r.fromPersonId !== r.personId,
    };
  }

  return NextResponse.json(
    {
      data: {
        family: {
          id: family.id,
          name: family.name,
          surname: family.surname,
        },
        rootPersonId,
        rootPersonName,
        branchInfo,
        lineage,
        focusPersonId: focusParam ?? null,
        upGen: focusParam ? upGen : null,
        stats,
        layout,
        generationChars,
        residenceByPersonId,
      },
    },
    {
      headers: {
        // 60s 浏览器缓存，相同参数复用
        "Cache-Control": "private, max-age=60",
      },
    },
  );
}
