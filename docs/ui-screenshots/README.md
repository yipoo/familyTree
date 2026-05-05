# UI 截图（真实数据）

抓取时间：2026-05-05
家族数据：丁氏家族（10,580 人 · 24 代）
账号：13800138000（SUPERADMIN）
基址：http://localhost:3010
脚本：[scripts/screenshot-ui.ts](../../scripts/screenshot-ui.ts)

每个页面都有 4 张：`<page>-<viewport>-<theme>.png`，组合 = 桌面 1440×900 / 移动 375×812 × light / dark。

## 1 · 登录页 `/login`

未登录态。卡片居中、单色 CTA、辅助链接（验证码登录 / 注册）。

- ![desktop-light](01-login-desktop-light.png) `01-login-desktop-light.png`
- ![desktop-dark](01-login-desktop-dark.png) `01-login-desktop-dark.png`
- ![mobile-light](01-login-mobile-light.png) `01-login-mobile-light.png`
- ![mobile-dark](01-login-mobile-dark.png) `01-login-mobile-dark.png`

## 2 · Dashboard `/`

登录后首屏。三段卡片：全部家族 / 人数（合计） / 本月新增人物；下方是家族卡 + 快捷操作 + 最近活动。

- ![desktop-light](02-dashboard-desktop-light.png) `02-dashboard-desktop-light.png`
- ![desktop-dark](02-dashboard-desktop-dark.png) `02-dashboard-desktop-dark.png`
- ![mobile-light](02-dashboard-mobile-light.png) `02-dashboard-mobile-light.png`
- ![mobile-dark](02-dashboard-mobile-dark.png) `02-dashboard-mobile-dark.png`

## 3 · 个人页 `/me`

头像 + 手机号 + 平台角色徽标；左侧基本信息、右侧改密码、下方"我的家族 / 我管理的子树"。

- ![desktop-light](03-me-desktop-light.png) `03-me-desktop-light.png`
- ![desktop-dark](03-me-desktop-dark.png) `03-me-desktop-dark.png`
- ![mobile-light](03-me-mobile-light.png) `03-me-mobile-light.png`
- ![mobile-dark](03-me-mobile-dark.png) `03-me-mobile-dark.png`

## 4 · 家族概览 `/f/[id]`

人数 / 男 / 女 + LineageTabs（全部 / 父系 / 母系），下面 StatsCards（人数 / 代数 / 婚配 / 30 天写操作 / 各代分布 / 各支系人数 / Top 10 居住地 / 最长寿等）。截图被裁到 ~3 屏避免 10580 人列表把图变巨大。

- ![desktop-light](04-family-overview-desktop-light.png) `04-family-overview-desktop-light.png`
- ![desktop-dark](04-family-overview-desktop-dark.png) `04-family-overview-desktop-dark.png`
- ![mobile-light](04-family-overview-mobile-light.png) `04-family-overview-mobile-light.png`
- ![mobile-dark](04-family-overview-mobile-dark.png) `04-family-overview-mobile-dark.png`

## 5 · 树谱 `/f/[id]/tree`

xy-flow 关系树。10580 个节点 fit-to-view 后非常密集，只能看出形状轮廓；左侧是世代轴。Inspector 默认折叠。

- ![desktop-light](05-tree-desktop-light.png) `05-tree-desktop-light.png`
- ![desktop-dark](05-tree-desktop-dark.png) `05-tree-desktop-dark.png`
- ![mobile-light](05-tree-mobile-light.png) `05-tree-mobile-light.png`
- ![mobile-dark](05-tree-mobile-dark.png) `05-tree-mobile-dark.png`

## 6 · 详细图 `/f/[id]/table`

按"家庭单元"分组（共 4564 个）展开。截图也是裁到 ~3 屏。

- ![desktop-light](06-table-desktop-light.png) `06-table-desktop-light.png`
- ![desktop-dark](06-table-desktop-dark.png) `06-table-desktop-dark.png`
- ![mobile-light](06-table-mobile-light.png) `06-table-mobile-light.png`
- ![mobile-dark](06-table-mobile-dark.png) `06-table-mobile-dark.png`

## 7 · 吊线图 `/f/[id]/lineage`

传统纸质吊线图样式。SVG 始终采用白纸黑字（与 PDF 输出一致），所以暗色模式下 SVG 仍是白底，这是有意的"纸张预览"语义。

- ![desktop-light](07-lineage-desktop-light.png) `07-lineage-desktop-light.png`
- ![desktop-dark](07-lineage-desktop-dark.png) `07-lineage-desktop-dark.png`
- ![mobile-light](07-lineage-mobile-light.png) `07-lineage-mobile-light.png`
- ![mobile-dark](07-lineage-mobile-dark.png) `07-lineage-mobile-dark.png`

## 8 · 册谱 `/f/[id]/album`

紙質族谱网页版：封面 / 序 / 字辈表 / 各卷各章人物条目。同步用于 PDF 导出。截图裁到 ~3 屏。

- ![desktop-light](08-album-desktop-light.png) `08-album-desktop-light.png`
- ![desktop-dark](08-album-desktop-dark.png) `08-album-desktop-dark.png`
- ![mobile-light](08-album-mobile-light.png) `08-album-mobile-light.png`
- ![mobile-dark](08-album-mobile-dark.png) `08-album-mobile-dark.png`

## 9 · 高级搜索 `/f/[id]/search`

按 关键字 / 性别 / 状态 / 嫁入 / 支系 / 字辈 / 世代区间 / 生年区间 / 出生地 / 排序 / 结果上限 多条件检索。

- ![desktop-light](09-search-desktop-light.png) `09-search-desktop-light.png`
- ![desktop-dark](09-search-desktop-dark.png) `09-search-desktop-dark.png`
- ![mobile-light](09-search-mobile-light.png) `09-search-mobile-light.png`
- ![mobile-dark](09-search-mobile-dark.png) `09-search-mobile-dark.png`

## 10 · 人物详情 `/f/[id]/p/[personId]`

人物：丁氏 9 代 · 尚偉。包含基本信息 / 文字记述 / 父母 / 婚配 / 子女 / 同父母兄弟姐妹 / 迁徙；右栏导航 + 管理操作。

- ![desktop-light](10-person-detail-desktop-light.png) `10-person-detail-desktop-light.png`
- ![desktop-dark](10-person-detail-desktop-dark.png) `10-person-detail-desktop-dark.png`
- ![mobile-light](10-person-detail-mobile-light.png) `10-person-detail-mobile-light.png`
- ![mobile-dark](10-person-detail-mobile-dark.png) `10-person-detail-mobile-dark.png`

## 11 · 审计日志 `/f/[id]/admin/audit`

后台 admin 顶栏布局：左侧子页面胶囊 tabs（mobile 折成多行）+ 主区。表格修复后在移动端能正常横向滚动，列头不再压缩成两行。

- ![desktop-light](11-admin-audit-desktop-light.png) `11-admin-audit-desktop-light.png`
- ![desktop-dark](11-admin-audit-desktop-dark.png) `11-admin-audit-desktop-dark.png`
- ![mobile-light](11-admin-audit-mobile-light.png) `11-admin-audit-mobile-light.png`
- ![mobile-dark](11-admin-audit-mobile-dark.png) `11-admin-audit-mobile-dark.png`

---

## 实现说明

- 多视口 / 主题：`zupu-theme` cookie 写入 `light` / `dark`，并设置 Playwright `colorScheme` 让 prefers-color-scheme 也对齐主题，避免 `system` 三态闪烁。
- 登录：通过 `/login` 表单填手机号 + 密码，POST `/api/login` → 设置 `authjs.session-token` cookie → 跳转 `/dashboard`。
- 重型页面（家族概览 / 详细图 / 册谱）截图被裁到 `viewport.height × 3`，规避 10k+ 节点 fullPage 触发 Chromium tile 内存上限崩溃。
- xy-flow 类页面（树谱 / 吊线图）容器是 100vh，没有滚动条，等价视口截图。

## 修复的 UI bug

- **审计日志表格在移动端** ([app/f/[familyId]/admin/audit/AuditLogTable.tsx](../../app/f/[familyId]/admin/audit/AuditLogTable.tsx))：原 `<table className="w-full">` 在 375px 宽下被压缩，"类型"列头折成两行、"操作人"列被裁、"详情"列消失。改为 `min-w-[680px]` + 每列 `whitespace-nowrap` + `-mx-4 sm:mx-0` 让外层 `overflow-x-auto` 正常生效，移动端可横向滚动；桌面端不变。
