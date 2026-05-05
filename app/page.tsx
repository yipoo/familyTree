/**
 * 站点入口 / —— 永远展示营销 Landing。
 *
 * 已登录用户在 MarketingNav 上能看到「进入我的家族 →」链接到 /dashboard；
 * 未登录用户看到「登录 / 免费注册」。
 */
import { Landing } from "@/components/marketing/Landing";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Landing />;
}
