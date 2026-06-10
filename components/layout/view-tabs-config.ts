/**
 * ViewTabs 数据装配函数 + 类型定义。
 *
 * - 用 IconKey（字符串）而非组件函数，确保 server -> client 边界能序列化
 * - server 端调 buildFamilyTabs 拿到 icon key，client 端 ViewTabs 内部
 *   把 key 映射为真正的图标组件
 */

export type IconKey =
  | "home"
  | "tree"
  | "table"
  | "lineage"
  | "wufu"
  | "circle"
  | "book"
  | "search"
  | "route"
  | "shield";

export interface ViewTab {
  href: string;
  label: string;
  /** 严格匹配 pathname == href */
  exact?: boolean;
  /** 角标 */
  badge?: number;
  icon: IconKey;
  /** 同组的标签在桌面端顶栏会折叠进一个下拉（避免标签过多）。chart = 图谱视图 */
  group?: "chart";
}

export function buildFamilyTabs({
  familyId,
  canManage,
  pendingCount,
}: {
  familyId: string;
  canManage: boolean;
  pendingCount: number;
}): ViewTab[] {
  const tabs: ViewTab[] = [
    {
      href: `/f/${familyId}`,
      label: "概览",
      exact: true,
      icon: "home",
    },
    { href: `/f/${familyId}/tree`, label: "树谱", icon: "tree", group: "chart" },
    { href: `/f/${familyId}/table`, label: "详细图", icon: "table", group: "chart" },
    { href: `/f/${familyId}/lineage`, label: "吊线图", icon: "lineage", group: "chart" },
    { href: `/f/${familyId}/wufu`, label: "五服图", icon: "wufu", group: "chart" },
    { href: `/f/${familyId}/circle`, label: "族谱圆", icon: "circle", group: "chart" },
    { href: `/f/${familyId}/map`, label: "迁徙图", icon: "route", group: "chart" },
    { href: `/f/${familyId}/album`, label: "册谱", icon: "book" },
    { href: `/f/${familyId}/search`, label: "搜索", icon: "search" },
  ];
  if (canManage) {
    tabs.push({
      href: `/f/${familyId}/admin/migrations`,
      label: "迁徙管理",
      icon: "route",
    });
    tabs.push({
      href: `/f/${familyId}/admin`,
      label: "后台",
      icon: "shield",
      badge: pendingCount > 0 ? pendingCount : undefined,
    });
  }
  return tabs;
}
