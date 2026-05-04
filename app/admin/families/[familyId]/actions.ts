"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { FamilyRole } from "@/lib/generated/prisma/enums";

async function ensureSuper(): Promise<string> {
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

// ---------------- FamilyMember ----------------

export async function addMemberByPhone(
  familyId: string,
  phone: string,
  role: FamilyRole,
) {
  await ensureSuper();
  const cleaned = phone.trim();
  if (!cleaned) throw new Error("请填写手机号");
  const user = await prisma.user.findUnique({ where: { phone: cleaned } });
  if (!user) throw new Error("该手机号未注册");
  await prisma.familyMember.upsert({
    where: { userId_familyId: { userId: user.id, familyId } },
    create: { userId: user.id, familyId, role },
    update: { role },
  });
  revalidatePath(`/admin/families/${familyId}`);
}

export async function changeMemberRole(
  familyId: string,
  userId: string,
  role: FamilyRole,
) {
  await ensureSuper();
  await prisma.familyMember.update({
    where: { userId_familyId: { userId, familyId } },
    data: { role },
  });
  revalidatePath(`/admin/families/${familyId}`);
}

export async function removeMember(familyId: string, userId: string) {
  await ensureSuper();
  await prisma.familyMember.delete({
    where: { userId_familyId: { userId, familyId } },
  });
  revalidatePath(`/admin/families/${familyId}`);
}

// ---------------- SubtreeAdmin ----------------

export async function grantSubtreeAdmin(
  familyId: string,
  userPhone: string,
  rootPersonId: string,
  note?: string | null,
) {
  const meId = await ensureSuper();
  const cleaned = userPhone.trim();
  if (!cleaned) throw new Error("请填写授权对象手机号");
  if (!rootPersonId) throw new Error("请选择 root 人物");

  const user = await prisma.user.findUnique({ where: { phone: cleaned } });
  if (!user) throw new Error("该手机号未注册");

  const person = await prisma.person.findFirst({
    where: { id: rootPersonId, familyId, deletedAt: null },
  });
  if (!person) throw new Error("人物不属于该家族");

  await prisma.subtreeAdmin.create({
    data: {
      userId: user.id,
      familyId,
      rootPersonId,
      grantedById: meId,
      note: note?.trim() || null,
    },
  });
  revalidatePath(`/admin/families/${familyId}`);
}

export async function revokeSubtreeAdmin(familyId: string, grantId: string) {
  await ensureSuper();
  await prisma.subtreeAdmin.delete({ where: { id: grantId } });
  revalidatePath(`/admin/families/${familyId}`);
}
