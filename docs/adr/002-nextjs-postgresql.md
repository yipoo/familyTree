# ADR 002：采用 Next.js + PostgreSQL 作为核心栈

- 状态：已接受
- 日期：2026-04-15

## 背景

家谱 Web 需要 SSR/流式首屏、强类型全栈、与关系型事务数据（人员、关系、审计）紧密结合；团队希望单一仓库、部署路径清晰。

## 选项

1. **Next.js（全栈）+ PostgreSQL**：UI 与 Route Handlers/Server Actions 同仓；数据访问用 Prisma（见 ADR 003）。
2. **独立 SPA（Vite）+ 后端（Nest/FastAPI）+ PostgreSQL**：前后端分离，API 契约清晰，但仓库与发布协调成本更高。
3. **其他全栈框架 + PostgreSQL**：生态与招聘面相对 Next 略窄。

## 决策

采用 **选项 1：Next.js + PostgreSQL**。

- 利用 App Router 在服务端完成鉴权与租户过滤，减少「仅前端隐藏」风险。
- PostgreSQL 满足多租户、JSONB 快照、复杂统计与可选 RLS。
- 长作业通过独立 Worker 或托管队列与 Next 解耦（见 `12-tech-stack.md`）。

## 后果

- 需注意 Serverless 下数据库连接数；必须配置连接池或 Serverless 友好驱动。
- 重型 CPU 任务（大 PDF）应放在 Worker，避免拖慢 Serverless 函数。
- 若未来需多端原生 App，可保留 Route Handlers 作为稳定 REST 面对外。

## 相关文档

- `docs/12-tech-stack.md`
- `docs/02-architecture.md` §10
