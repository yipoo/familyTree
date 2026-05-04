"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireFamilyWrite } from "@/lib/auth/guard";

type Result = { ok?: true; error?: string };

const MAX_GENERATION = 200;

export async function upsertGeneration(
  familyId: string,
  _prev: Result | undefined,
  formData: FormData,
): Promise<Result> {
  try {
    await requireFamilyWrite(familyId);
    const gen = Number(formData.get("generation") ?? 0);
    const ch = String(formData.get("character") ?? "").trim();
    if (!Number.isFinite(gen) || gen < 1 || gen > MAX_GENERATION) {
      return { error: "世代须为 1 ~ 200 的整数" };
    }
    if (!ch || ch.length > 4) {
      return { error: "字辈最多 4 个字符" };
    }
    await prisma.generationName.upsert({
      where: { familyId_generation: { familyId, generation: gen } },
      update: { character: ch },
      create: { familyId, generation: gen, character: ch },
    });
    revalidatePath(`/f/${familyId}/admin/generations`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
}

export async function updateGenerationChar(
  familyId: string,
  generation: number,
  character: string,
): Promise<Result> {
  try {
    await requireFamilyWrite(familyId);
    const ch = character.trim();
    if (!ch || ch.length > 4) return { error: "字辈最多 4 个字符" };
    await prisma.generationName.update({
      where: { familyId_generation: { familyId, generation } },
      data: { character: ch },
    });
    revalidatePath(`/f/${familyId}/admin/generations`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
}

export async function deleteGeneration(
  familyId: string,
  generation: number,
): Promise<Result> {
  try {
    await requireFamilyWrite(familyId);
    // 检查是否仍被某 person.generation 引用，引用时仅删除 GenerationName 不删 Person
    await prisma.generationName.delete({
      where: { familyId_generation: { familyId, generation } },
    });
    revalidatePath(`/f/${familyId}/admin/generations`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
}
