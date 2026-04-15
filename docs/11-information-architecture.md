# 信息架构与导航

## 1. 顶层导航（建议）

| 模块 | 路径示例 | 说明 |
|------|----------|------|
| 仪表盘 | `/:tenantId` | KPI、待办、最近动态 |
| 家谱 | `/:tenantId/tree` | 树状主视图 |
| 人员 | `/:tenantId/persons` | 表格、高级搜索、智能列表 |
| 地图 | `/:tenantId/map` | 籍贯/迁徙（有坐标或结构化地点时） |
| 统计 | `/:tenantId/stats` | 子导航见下节 |
| 媒体 | `/:tenantId/media` | 库与相册 |
| 协作 | `/:tenantId/inbox` | 工单、@、通知 |
| 谱书 | `/:tenantId/pedigree` | 版本快照与只读浏览 |
| 导入导出 | `/:tenantId/data` | GEDCOM、表格、备份 |
| 设置 | `/:tenantId/settings` | 空间、成员、权限、字典 |
| 帮助 | `/help` | 全局或租户上下文帮助 |

## 2. 统计子导航

- `/:tenantId/stats/overview` 总览
- `/:tenantId/stats/structure` 结构
- `/:tenantId/stats/lifecycle` 生命周期
- `/:tenantId/stats/geography` 地理
- `/:tenantId/stats/titles` 字辈
- `/:tenantId/stats/quality` 数据质量
- `/:tenantId/stats/reports` 自定义报表

## 3. 人员详情内 Tab

- 概要、关系、事件、媒体、来源、讨论、修订历史（有权限时）

## 4. 管理后台（可与设置合并或独立）

- 成员与角色、审计日志、用量、危险操作（合并队列、回收站）。

## 5. 路由与权限

- 进入租户前校验 `tenant_member`；无资格跳转申请或 403 页。
- 深度链接：树节点、人员详情、统计带筛选器 query 均可分享（受可见性约束）。
