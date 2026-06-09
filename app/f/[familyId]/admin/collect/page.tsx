import { AdminSection } from "../_shared";
import { CollectManager } from "./CollectManager";

export const dynamic = "force-dynamic";

export default async function AdminCollectPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  return (
    <AdminSection
      title="二维码采集"
      description="为某位族人生成采集二维码 / 链接，TA 无需登录即可补全自己或子女的信息，提交后进入「待审提交」由你审核录入。"
    >
      <CollectManager familyId={familyId} />
    </AdminSection>
  );
}
