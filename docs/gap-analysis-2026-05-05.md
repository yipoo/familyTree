# 上线就绪缺口分析（2026-05-05）

> 这份文档原本由产品 / 项目方提供，为方便溯源在仓库内补一份。源清单与本批工作的 Plan 完全一致：先做 P0（红线），再做 P1（上线时该有），最后做 P2（打磨）。

## P0 上线红线

### A. 限流中间件
- 登录 / 验证码 / 注册 / 导出（PDF + GEDCOM/CSV/JSON）/ Excel 导入 这些敏感端点都要加
- 用 IP + 用户 ID 双键限流
- `lib/rate-limit.ts` 实现 token bucket（基于内存 LRU 即可，单实例够用），加 `withRateLimit(handler, {key, limit, windowMs})` 中间件
- 触发限流返回 429 + `Retry-After` header
- 单元测试覆盖：限流触发、窗口滑动、双键独立计数

### B. `.env.example` + 部署文档
- `.env.example`：把所有 `process.env.*` 列全（DATABASE_URL、AUTH_SECRET、SMS provider 配置、SMTP 配置等）
- 新建 `docs/deploy.md`：本地起步、Postgres 安装与初始化、迁移、种子、生产部署、备份策略、env 变量速查、常见问题
- README 补"快速开始"链接

### C. PDF 异步化
- 当前同步生成会在 prod 超时（serverless 默认 10-60s 上限）
- 改成"提交任务 → 返回 jobId → 轮询/SSE 拿进度 → 拿结果链接"
- `PdfJob` 表（id / familyId / type / status / progress / outputUrl / error / createdAt / updatedAt / requestedById）
- `lib/services/pdf-queue.ts`（内存 queue + 可替换接口；后续上 BullMQ 也行），并发上限 1
- `app/api/families/[fid]/lineage-chart/pdf` 和 `album/pdf`：原 GET 改成 POST 创建任务返回 jobId；新增 GET `/api/families/[fid]/pdf-jobs/[jobId]` 查状态 / 下载
- 前端 `/lineage` 和 `/album` 页面 PDF 按钮改成"开始生成 → 进度条 → 下载"流程

### D. Family 单条 CRUD
- `app/api/families/[familyId]/route.ts` GET 单条详情、PATCH 改名/描述、DELETE 软删
- 角色守卫：GET 看权限、PATCH OWNER 或 ADMIN、DELETE 仅 OWNER
- AuditLog
- DELETE 写软删字段，所有家族列表查询自动过滤

## P1 上线时该有

### A. 近亲 5 代过滤 `?mode=kin5&root=...`
- `app/api/families/[fid]/graph/route.ts` 加 `?mode=full|kin5&root=<personId>` 参数
- kin5 = 以 root 为中心的 ±2 代直系（祖父母、父母、自己、子女、孙子女）+ 配偶 + 兄弟姐妹
- 抽 `lib/services/kinship.ts`
- 树谱页加"近亲视图"切换
- 单元测试：复杂家族下 kin5 的边界情况

### B. Branches CRUD API
- `app/api/families/[fid]/branches/` GET / POST
- `[branchId]/` GET / PATCH / DELETE
- DELETE 时检查是否有人物挂在该支系
- AuditLog
- 后台 admin/branches 页面接入

### C. 文档承诺但未做的小项
- 报告里 🟡 部分完成的全部补齐

## P2 后续打磨

### A. 响应式调优
- Playwright 截图脚本 375/768/1024/1440 四个断点
- 重点：树谱小屏工具栏、详细图列折叠、表单/卡片 padding

### B. Undo / 操作历史
- 基于 AuditLog 表
- `/f/[fid]/admin/audit` 加"撤回"按钮（仅 OWNER/ADMIN，且 24 小时内）
- 撤回也写一条新 AuditLog

### C. 发现页 `/discover`
- 跨家族浏览（仅公开家族，schema 加 `isPublic` 字段，默认 false）
- 简单卡片列表 + 搜索

### D. 子树管理员权限闭环验证
- 单元 / 集成测试覆盖：子树管理员只能改自己负责的支系内人物

## 执行约束

- 涉及 schema 变更合并到一份 migration：`<timestamp>_p0p1p2_complete.prisma`
- 性能：10580 人规模实测，慢的 API 加索引（写到 migration 里）
- 安全：所有新 API 都过 Zod + auth guard + AuditLog
- 测试：每个新功能至少有单元测试
- 验收：lint + tsc + test + build 全绿
