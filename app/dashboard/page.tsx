/**
 * /dashboard —— 已登录用户的家族列表入口。
 *
 * 与 / 的区别：
 *   /         始终展示 Landing（介绍 / 价格 / 病毒 CTA），未登录可见
 *   /dashboard 始终展示 Dashboard，需要登录（middleware 保证）
 */
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return <Dashboard />;
}
