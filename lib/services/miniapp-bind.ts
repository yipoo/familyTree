/**
 * 小程序"纯自动匹配"定位逻辑（纯函数部分）。
 *
 * 给定全库候选（familyId + personId + contactPhoneHash）与登录手机号哈希，
 * 返回"我的位置"列表——每个家族至多一个节点（同哈希多命中取首个，避免歧义）。
 */

export interface PositionCandidate {
  familyId: string;
  familyName: string;
  personId: string;
  personName: string;
  generation: number;
  contactPhoneHash: string | null;
}

export interface MatchedPosition {
  familyId: string;
  familyName: string;
  personId: string;
  personName: string;
  generation: number;
}

export function matchPositions(
  candidates: PositionCandidate[],
  phoneHash: string,
): MatchedPosition[] {
  const seen = new Set<string>();
  const out: MatchedPosition[] = [];
  for (const c of candidates) {
    if (!c.contactPhoneHash || c.contactPhoneHash !== phoneHash) continue;
    if (seen.has(c.familyId)) continue; // 每家族取一个
    seen.add(c.familyId);
    out.push({
      familyId: c.familyId,
      familyName: c.familyName,
      personId: c.personId,
      personName: c.personName,
      generation: c.generation,
    });
  }
  return out;
}
