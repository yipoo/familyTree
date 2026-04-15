# 技术栈（已定）

本文档为工程实现的**单一技术选型说明**，与 `02-architecture.md` 中的逻辑架构配套。变更栈内关键组件时，应新增 ADR 并同步本节。

| 层级 | 选型 | 版本约束（建议） |
|------|------|------------------|
| 运行时 | Node.js（Next 构建与 Server 运行时） | 与 Next.js 官方要求一致，优先 LTS |
| Web 框架 | **Next.js**（App Router） | 当前稳定大版本；启用 TypeScript 严格模式 |
| UI | React | 随 Next 捆绑版本 |
| 数据库 | **PostgreSQL** | 15+（生产建议 16+） |
| ORM | **Prisma**（`@prisma/client` + **Prisma Migrate**） | 迁移与 schema 以 Prisma 为唯一来源 |
| 对象存储 | S3 兼容 API（AWS S3 / Cloudflare R2 / MinIO） | 与实现无关的协议层 |

---

## 1. Next.js 应用形态

### 1.1 路由与目录

- 使用 **App Router**（`app/`），按租户分段路由，例如：`app/(dashboard)/[tenantId]/...`。
- **布局（Layout）**：租户级布局加载成员身份、主题与侧边导航；鉴权失败走统一错误页。
- **Loading / Error**：对树与统计页提供 `loading.tsx`、`error.tsx`，避免白屏。

### 1.2 服务端与客户端边界

| 场景 | 推荐 |
|------|------|
| 首屏数据、SEO、权限敏感读取 | **React Server Components** 内直接查库或通过 server-only 仓储层 |
| 家谱交互、缩放平移、复杂客户端状态 | **`use client`** 组件 |
| 对外/移动端共用的 HTTP API | **Route Handlers** `app/api/.../route.ts` |
| 表单 mutation、简单内聚写操作 | **Server Actions**（配合 Zod + 权限校验）或 Route Handlers（二选一切团队统一） |

原则：**权限校验与租户隔离发生在服务端**（RSC、Server Action、Route Handler 内），不在浏览器内信任角色字符串。

### 1.3 中间件

- `middleware.ts`：会话解析、全局安全头、可选子域名 → `tenantId` 解析；避免在中间件内做重查询，仅 JWT/Cookie 解析与轻量重定向。

### 1.4 数据获取（客户端）

- **TanStack Query**：仅用于 Client Component 中的交互式列表、树增量加载、统计筛选；`queryKey` 必须包含 `tenantId`。
- Server Component 内优先 `async` 直接调用数据层，不强制套 Query。

---

## 2. PostgreSQL 与数据访问

### 2.1 ORM（已定）

- **Prisma** + **Prisma Migrate**：`schema.prisma` 为表结构单一事实来源；迁移文件入版本库，禁止手写漂移 SQL 与 Prisma 并存。
- 与 TypeScript 集成成熟；注意 Serverless **冷启动与连接数**（见 §2.2），复杂只读查询必要时用 **`$queryRaw` 已参数化** 或视图，仍经同一 Prisma 客户端。
- 选型记录：**[`adr/003-prisma-orm.md`](./adr/003-prisma-orm.md)**。

### 2.2 连接与会话模式

| 部署形态 | 建议 |
|----------|------|
| 传统长驻 Node（Docker `next start`） | Prisma 默认连接池即可；生产前加 **PgBouncer**（transaction mode） |
| Serverless（如 Vercel 函数） | 使用支持 Serverless 的连接方案：**Neon / Supabase pooler** 或 Prisma Accelerate；控制并发与 `connection_limit` |

### 2.3 数据库能力使用

- 业务扩展字段可用 **JSONB**；统计快照、导入 staging 适用。
- 可选 **RLS** 作纵深防御；应用层仍须显式 `tenant_id` 过滤（见 `03-data-model.md`）。
- 全文检索：优先 **PostgreSQL**（`pg_trgm` / GIN）；数据量与并发上来后再评估独立搜索引擎（另立 ADR）。

---

## 3. 认证与会话

- 推荐 **Auth.js（原 NextAuth v5）**：与 Next App Router 集成成熟；支持 Credentials、OAuth Provider、Email Magic Link（按产品需要启用）。
- 会话存 **数据库 Adapter** 或 **JWT**（短效）策略由 ADR 细化；刷新令牌旋转与 `@auth` 回调中写入 `tenant_roles` 声明供数据层使用。

---

## 4. 校验、类型与 API 契约

- **Zod**：Server Actions / Route Handlers 入参、环境变量解析。
- **OpenAPI**：可由 Route Handlers 手写 YAML，或用工具从 Zod 生成；与 `04-api-design.md` 对齐。
- **TypeScript**：`strict: true`；领域类型与 Prisma 生成类型分层（避免把 ORM 类型泄漏到全客户端包）。

---

## 5. 样式与组件

- **Tailwind CSS**：布局与间距统一。
- 组件库可选 **shadcn/ui**（Radix）：无障碍基线好；与家谱画布样式解耦。

---

## 6. 异步任务与长耗时作业

GEDCOM 解析、PDF 导出、大批量统计重算 **不得** 阻塞 Next.js HTTP 线程。

| 方案 | 说明 |
|------|------|
| **独立 Worker 进程**（推荐生产） | 同仓库单独 `worker` 包：`tsx`/`node` 消费 **BullMQ**（Redis）队列；与 Web 容器分离扩缩容。 |
| **托管队列** | **Inngest** / **Trigger.dev** 等与 Next 集成，适合快速上线、少运维。 |

本地开发可用 **同一 Docker Compose** 起 Redis + worker + web。

---

## 7. 缓存与限流

- **Redis**（可选但强烈建议生产）：会话黑名单、导入互斥锁、统计短期缓存、队列。
- 限流：中间件或 Route Handler 内基于 Redis 的滑动窗口；登录接口单独严格限流。

---

## 8. 可观测性

- **结构化日志**：`pino` 或兼容库；Vercel 上则用平台日志。
- **OpenTelemetry**：按需接入；trace 关联 `trace_id` 与 `tenant_id`（注意隐私脱敏）。
- **健康检查**：独立 Route Handler `GET /api/health` 返回 DB ping 结果供编排探活。

---

## 9. 部署选项

### 9.1 托管（快速）

- **Vercel** 部署 Next；**Neon** / **Supabase** 托管 Postgres；**R2** / **S3** 媒体；Worker 用 Inngest 或单独小服务。

### 9.2 自托管（可控）

- **Docker Compose / K8s**：`web`（`next start`）+ `worker` + `postgres` + `redis` + `minio`。
- 前置 **Nginx** 或云 LB；TLS 终止在边缘。

---

## 10. 与文档体系的交叉引用

| 主题 | 文档 |
|------|------|
| 逻辑架构与数据流 | `02-architecture.md` |
| 表与约束 | `03-data-model.md` |
| HTTP 形状 | `04-api-design.md` |
| 前端模块与家谱性能 | `06-frontend-architecture.md` |
| 运维与备份 | `09-operations.md` |
| 全栈选型理由 | `adr/002-nextjs-postgresql.md` |
| ORM 选型理由 | `adr/003-prisma-orm.md` |

---

## 11. 本地开发环境与数据库

### 11.1 数据库（本机 PostgreSQL）

- **部署方式**：开发者本机安装的 PostgreSQL（非云端）；连接地址一般为 `localhost`。
- **数据库名（已定）**：`family_tree_db`  
  在集群中先执行：`CREATE DATABASE family_tree_db;`（编码建议 `UTF8`，排序规则按团队统一，常用 `en_US.UTF-8` 或 `C`）。
- **Prisma / 应用连接串示例**（账号口令按本机实际修改）：

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_tree_db"
```

- 生产或 staging 使用**其他库名与连接串**；仅本地开发默认对齐 `family_tree_db`。

### 11.2 其他本地依赖（建议 Compose 服务名）

若 Redis、对象存储仍用容器，可与本机 Postgres 并存：

| 服务 | 镜像/说明 |
|------|-----------|
| `redis` | `redis:7-alpine` |
| `minio` | 可选，媒体开发用 |

仓库落地后在本节可追加 **docker-compose 文件名** 与 **一键启动命令**。
