"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { PlatformRole } from "@/lib/generated/prisma/enums";

async function ensureSuper() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("UNAUTHENTICATED");
  const me = await prisma.user.findUnique({
    where: { id },
    select: { platformRole: true },
  });
  if (me?.platformRole !== "SUPERADMIN") throw new Error("FORBIDDEN");
  return id;
}

export async function setPlatformRole(userId: string, role: PlatformRole) {
  const meId = await ensureSuper();
  if (userId === meId && role !== "SUPERADMIN") {
    throw new Error("不能取消自己的超级管理员权限（请用其他超级管理员账号操作）");
  }
  await prisma.user.update({ where: { id: userId }, data: { platformRole: role } });
  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string) {
  const meId = await ensureSuper();
  if (userId === meId) throw new Error("不能删除自己");
  // 注意：FamilyMember / SubtreeAdmin 因为 onDelete=Cascade 会同时删除
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
}
