/**
 * 家族相册（家族级影像）
 *
 * 路由：/f/[familyId]/photos
 *
 * 家族公共照片 / 老谱扫描件 / 影像归档（personId 为空的 Media）。
 * 人物专属影像在各自人物详情页。
 */
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageFamily } from "@/app/f/[familyId]/admin/actions";
import { ossConfigured } from "@/lib/services/oss";
import { MediaGallery } from "@/components/media/MediaGallery";

export const dynamic = "force-dynamic";

export default async function FamilyPhotosPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/f/${familyId}/photos`)}`);
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true },
  });
  const member = await prisma.familyMember.findUnique({
    where: { userId_familyId: { userId: session.user.id, familyId } },
    select: { role: true },
  });
  if (!member && me?.platformRole !== "SUPERADMIN") {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <h1 className="text-lg font-semibold">无权访问</h1>
        <p className="mt-2 text-sm text-fg-muted">请联系族长邀请你加入此家族。</p>
      </div>
    );
  }

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { id: true, name: true },
  });
  if (!family) notFound();

  const canWrite = await canManageFamily(familyId);

  return (
    <div>
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-[1440px] px-3 py-5 sm:px-5 lg:px-6">
          <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">家族相册</p>
          <h1 className="mt-1 font-serif text-xl font-semibold text-foreground">{family.name}</h1>
          <p className="mt-0.5 text-xs text-fg-muted">
            家族公共影像（老照片、祠堂、老谱扫描件等）。人物专属照片请在各自人物页上传。
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] p-3 sm:p-5 lg:p-6">
        <MediaGallery familyId={familyId} canWrite={canWrite} ossReady={ossConfigured()} />
      </main>
    </div>
  );
}
