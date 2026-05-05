/**
 * 站点入口 /
 *
 * - 未登录：营销 Landing 页
 * - 已登录：直接显示 Dashboard（"我的家族"仪表盘），少一次点 "进入我的家族" 跳转
 *
 * 这样符合现代 SaaS 习惯：访问根路径即看到自己的工作面板。
 */
import { auth } from "@/auth";
import { Dashboard } from "@/components/Dashboard";
import { Landing } from "@/components/marketing/Landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (session?.user?.id) {
    return <Dashboard />;
  }
  return <Landing />;
}
