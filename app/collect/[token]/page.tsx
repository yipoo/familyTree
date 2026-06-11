/**
 * 二维码采集 —— 公开填写页（无需登录）
 *
 * 族人扫码 / 打开链接 → 校正本人信息 或 补全子女 → 提交进审核队列。
 * 路由：/collect/[token]
 */
import { CollectForm } from "./CollectForm";

export const dynamic = "force-dynamic";

export default async function CollectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-md">
        <CollectForm token={token} />
      </div>
    </div>
  );
}
