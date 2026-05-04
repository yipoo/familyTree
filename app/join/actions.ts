"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { consumeInvite } from "@/lib/services/invites";

export async function joinByCode(
  rawCode: string,
): Promise<{ ok: true; familyId: string; alreadyMember: boolean } | { ok: false; error: string }> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "请先登录" };
  }

  const result = await consumeInvite(rawCode, user.id);
  if (!result.ok) {
    const msg =
      result.reason === "not_found"
        ? "邀请码无效"
        : result.reason === "expired"
          ? "邀请已过期"
          : result.reason === "revoked"
            ? "邀请已被撤销"
            : result.reason === "exhausted"
              ? "邀请名额已用完"
              : "加入失败";
    return { ok: false, error: msg };
  }

  revalidatePath("/me");
  revalidatePath("/");
  return {
    ok: true,
    familyId: result.familyId,
    alreadyMember: result.alreadyMember,
  };
}
