/**
 * 子树管理员权限判定的纯算法部分（与 prisma 解耦，便于单测）。
 *
 * 与 lib/auth/guard.ts 的 canWriteOnPerson 一一对应：
 *   - SUPERADMIN / OWNER / ADMIN ✅
 *   - 否则需要某个 SubtreeAdmin.rootPersonId 出现在 person 的父系祖先链里
 *   - 嫁入女性视为父系链的"根"，不继续上溯
 *
 * 这里把 "person → father" 的邻接表 / 嫁入标记 / role 抽出来，让测试可以构造
 * 任意家族骨架直接验证。
 */

export interface SubtreeJudgeInput {
  /** 用户在该家族内的角色（null 表示不是成员；SUPERADMIN 走外层短路，不传到这里） */
  role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST" | null;
  /** 平台超管 */
  isSuperAdmin: boolean;
  /** 用户被授权的子树根 personId 列表 */
  grants: string[];
  /** 待判定的 personId */
  targetPersonId: string;
  /** child → father 邻接（已按 isPrimary=true && parent.gender=MALE 过滤） */
  fatherOf: Map<string, string>;
  /** 嫁入标记（true 表示该 person 是嫁入女性，链到此处停止） */
  isMarriedIn: Map<string, boolean>;
}

const MAX_DEPTH = 64;

export function computePaternalChain(
  targetPersonId: string,
  fatherOf: Map<string, string>,
  isMarriedIn: Map<string, boolean>,
): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = targetPersonId;
  let depth = 0;
  while (cur && !seen.has(cur) && depth < MAX_DEPTH) {
    seen.add(cur);
    chain.push(cur);
    if (isMarriedIn.get(cur)) break;
    cur = fatherOf.get(cur);
    depth++;
  }
  return chain;
}

export function judgeSubtreeWrite(input: SubtreeJudgeInput): boolean {
  if (input.isSuperAdmin) return true;
  if (input.role === "OWNER" || input.role === "ADMIN") return true;
  if (input.grants.length === 0) return false;
  const grantSet = new Set(input.grants);
  const chain = computePaternalChain(
    input.targetPersonId,
    input.fatherOf,
    input.isMarriedIn,
  );
  return chain.some((a) => grantSet.has(a));
}
