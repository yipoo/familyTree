"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireFamilyWrite } from "@/lib/auth/guard";

type Result = { ok?: true; error?: string };

const FIELDS = ["province", "city", "county", "town", "village", "detail"] as const;

function buildFullText(data: Record<string, string | null>): string {
  return FIELDS.map((f) => data[f])
    .filter((s) => s && s.trim().length > 0)
    .join(" ");
}

export async function updateLocation(
  familyId: string,
  locationId: string,
  formData: FormData,
): Promise<Result> {
  try {
    await requireFamilyWrite(familyId);
    const data: Record<string, string | null> = {};
    for (const f of FIELDS) {
      const v = String(formData.get(f) ?? "").trim();
      data[f] = v || null;
    }
    const fullText = buildFullText(data);
    if (!fullText) return { error: "至少填写一项地点字段" };

    await prisma.location.update({
      where: { id: locationId },
      data: { ...data, fullText },
    });
    revalidatePath(`/f/${familyId}/admin/locations`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
}

/**
 * 删除未被引用的 Location。
 * 检查：Person.residenceId / Branch.locationId / PersonLocation / Migration.fromLocationId / .toLocationId
 */
export async function deleteUnusedLocation(
  familyId: string,
  locationId: string,
): Promise<Result> {
  try {
    await requireFamilyWrite(familyId);
    const [pCount, bCount, plCount, mFromCount, mToCount] = await Promise.all([
      prisma.person.count({ where: { residenceId: locationId } }),
      prisma.branch.count({ where: { locationId } }),
      prisma.personLocation.count({ where: { locationId } }),
      prisma.migration.count({ where: { fromLocationId: locationId } }),
      prisma.migration.count({ where: { toLocationId: locationId } }),
    ]);
    const total = pCount + bCount + plCount + mFromCount + mToCount;
    if (total > 0) {
      return {
        error: `仍被引用（人物 ${pCount}、支系 ${bCount}、历史住地 ${plCount}、迁徙 ${mFromCount + mToCount}），请先解除引用`,
      };
    }
    await prisma.location.delete({ where: { id: locationId } });
    revalidatePath(`/f/${familyId}/admin/locations`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
}

/**
 * 合并两个地点：把 `fromId` 的所有引用迁到 `toId`，再删除 `fromId`。
 * 用于清理同地点重复（如 fullText 略有差异但实为同处）。
 */
export async function mergeLocations(
  familyId: string,
  fromId: string,
  toId: string,
): Promise<Result> {
  try {
    await requireFamilyWrite(familyId);
    if (fromId === toId) return { error: "不能与自身合并" };
    const target = await prisma.location.findUnique({ where: { id: toId } });
    if (!target) return { error: "目标地点不存在" };

    await prisma.$transaction([
      prisma.person.updateMany({
        where: { residenceId: fromId },
        data: { residenceId: toId },
      }),
      prisma.branch.updateMany({
        where: { locationId: fromId },
        data: { locationId: toId },
      }),
      prisma.personLocation.updateMany({
        where: { locationId: fromId },
        data: { locationId: toId },
      }),
      prisma.migration.updateMany({
        where: { fromLocationId: fromId },
        data: { fromLocationId: toId },
      }),
      prisma.migration.updateMany({
        where: { toLocationId: fromId },
        data: { toLocationId: toId },
      }),
      prisma.location.delete({ where: { id: fromId } }),
    ]);

    revalidatePath(`/f/${familyId}/admin/locations`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
}
