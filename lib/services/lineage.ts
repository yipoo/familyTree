/**
 * 列表页谱系过滤（lineage filter）
 *
 * 父系（paternal）：本族男性 + 嫁入的妻子
 * 母系（maternal）：本族女性（包括嫁出的女儿；招赘女婿如已标 isMarriedIn=true 则也算）
 * 全部（all）：不过滤
 *
 * 此过滤用于"列表/卡片"型视图（家族详情人物列表、详细图）。
 * 与"以中心人物计算近亲 5 代"是两个独立维度，未来可叠加。
 */

import type { Prisma } from "@/lib/generated/prisma/client";

export type Lineage = "paternal" | "maternal" | "all";

export function parseLineage(v: string | string[] | undefined): Lineage {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "paternal" || s === "maternal" || s === "all") return s;
  return "paternal"; // 默认父系（与传统家谱一致）
}

export function lineagePersonWhere(lineage: Lineage): Prisma.PersonWhereInput {
  switch (lineage) {
    case "paternal":
      return {
        OR: [{ gender: "MALE" }, { isMarriedIn: true }],
      };
    case "maternal":
      return {
        gender: "FEMALE",
      };
    case "all":
    default:
      return {};
  }
}
