import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MembersSection } from "./MembersSection";
import { SubtreeAdminsSection } from "./SubtreeAdminsSection";

export const dynamic = "force-dynamic";

export default async function AdminFamilyDetailPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: {
      _count: { select: { persons: true, branches: true } },
    },
  });
  if (!family) notFound();

  const [members, grants] = await Promise.all([
    prisma.familyMember.findMany({
      where: { familyId },
      orderBy: { joinedAt: "asc" },
      include: {
        user: { select: { id: true, name: true, phone: true } },
      },
    }),
    prisma.subtreeAdmin.findMany({
      where: { familyId },
      orderBy: { grantedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        root: { select: { id: true, name: true, generation: true } },
        grantedBy: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/families" className="text-xs text-zinc-500 hover:underline">
          ← 家族列表
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {family.name}
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {family.surname} 姓 · 人数 {family._count.persons} · 支系 {family._count.branches}
          </span>
        </h1>
        {family.description && (
          <p className="mt-1 text-sm text-zinc-500">{family.description}</p>
        )}
      </div>

      <MembersSection familyId={familyId} members={members} />
      <SubtreeAdminsSection familyId={familyId} grants={grants} />
    </div>
  );
}
