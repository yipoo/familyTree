"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

type Result = { ok?: true; error?: string };

export async function updateProfile(
  _prev: Result | undefined,
  formData: FormData,
): Promise<Result> {
  let me;
  try {
    me = await requireUser();
  } catch {
    return { error: "请先登录" };
  }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "昵称不能为空" };
  if (name.length > 40) return { error: "昵称最长 40 字符" };

  await prisma.user.update({ where: { id: me.id }, data: { name } });
  revalidatePath("/me");
  return { ok: true };
}

export async function changePassword(
  _prev: Result | undefined,
  formData: FormData,
): Promise<Result> {
  let me;
  try {
    me = await requireUser();
  } catch {
    return { error: "请先登录" };
  }
  const oldPwd = String(formData.get("old") ?? "");
  const newPwd = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!oldPwd || !newPwd) return { error: "请填写完整" };
  if (newPwd.length < 6) return { error: "新密码至少 6 位" };
  if (newPwd !== confirm) return { error: "两次输入的新密码不一致" };
  if (newPwd === oldPwd) return { error: "新旧密码相同" };

  const u = await prisma.user.findUnique({
    where: { id: me.id },
    select: { passwordHash: true },
  });
  if (!u?.passwordHash) return { error: "账号未设置密码" };

  const ok = await verifyPassword(oldPwd, u.passwordHash);
  if (!ok) return { error: "原密码错误" };

  const passwordHash = await hashPassword(newPwd);
  await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash },
  });
  return { ok: true };
}
