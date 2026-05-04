import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TreeView } from "@/components/tree/TreeView";

export const dynamic = "force-dynamic";

export default async function TreePage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  // 仅做家族存在性校验，layout 数据完全由客户端按需拉取
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true, name: true },
  });
  if (!family) notFound();

  return <TreeView familyId={family.id} familyName={family.name} />;
}
