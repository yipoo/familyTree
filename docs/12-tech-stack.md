# 技术栈

> 版本：v0.1（草案）
> 配套：`02-architecture.md`

## 1. 选型总览

| 层 | 选型 | 版本（建议） | 备选 / 备注 |
|---|---|---|---|
| 语言 | TypeScript | 5.x | 全栈统一 |
| 前端框架 | Next.js（App Router） | 15.x | 已初始化 |
| UI 样式 | Tailwind CSS | 4.x | 已随 Next 模板 |
| 组件库 | shadcn/ui + Radix | latest | 轻量、可裁剪 |
| 图标 | lucide-react | latest | |
| 状态-服务端 | TanStack Query | 5.x | |
| 状态-本地 | Zustand | 4.x | 简单 UI 状态 |
| 表单 | React Hook Form + Zod | latest | Zod 复用为 API 校验 |
| 树谱可视化 | React Flow | 12.x | 备选 D3：自渲染更灵活但工作量大 |
| 吊线图 | 自研 SVG（Reingold–Tilford 布局） | — | |
| PDF 导出 | @react-pdf/renderer | latest | 服务端渲染册谱 |
| Excel 导入导出 | exceljs | latest | |
| 后端 | Next.js API Routes | 15.x | 远期可拆为独立 Node 服务 |
| 认证 | Auth.js (NextAuth) | 5.x | 邮箱/手机号；远期接微信 |
| ORM | Prisma | 5.x | |
| 数据库 | PostgreSQL | 16+ | 关系建模天然契合家谱 |
| 全文搜索 | PostgreSQL `pg_trgm` | 内置 | 远期可换 ES |
| 部署 | Vercel / 自建 Node + Postgres | — | 远期容器化 |
| 监控 | Sentry | latest | 远期接入 |
| 包管理 | pnpm | 9.x | 已在仓库内 |
| 代码质量 | ESLint + Prettier + TypeScript strict | — | |
| 测试 | Vitest + Playwright | latest | 单测 + E2E |

## 2. 选型理由要点

### 2.1 Next.js 全栈（一期）
- 一套仓库 + 一套部署，降低早期复杂度
- App Router 自带数据获取与缓存
- 二期需要拆分时，API Routes 平滑迁移到独立 Node 服务（保持路由前缀 `/api`）

### 2.2 PostgreSQL + Prisma
- 家谱关系结构清晰（人、婚、亲子、支系），关系型数据库是最自然选择
- Prisma schema 同时充当文档；迁移可追溯
- 不选图数据库（如 Neo4j）：单族数据量级小（≤ 5000 人），关系查询用 SQL + 内存图算法足够，运维成本更低

### 2.3 React Flow（树谱）
- 节点/连线模型契合树谱
- 内建缩放、平移、触屏手势（覆盖手机浏览器需求）
- 支持自定义节点（头像、性别色、字辈标记）
- 备选 D3：表达力更强但需自行实现交互层，工作量翻倍

### 2.4 Tailwind + shadcn/ui
- Tailwind 响应式断点天然支持桌面/平板/手机
- shadcn 提供可复制可裁剪的组件源码，避免锁定

### 2.5 Auth.js
- 一期：邮箱 / 手机号验证码
- 二期：可加微信登录（小程序、App 关键）

## 3. 目录结构（建议）

```
family/
├─ app/                          # Next.js App Router
│  ├─ (marketing)/               # 落地页等
│  ├─ (app)/
│  │  ├─ f/[familyId]/
│  │  │  ├─ tree/page.tsx
│  │  │  ├─ scroll/page.tsx
│  │  │  ├─ table/page.tsx
│  │  │  ├─ book/page.tsx
│  │  │  ├─ admin/page.tsx
│  │  │  └─ p/[personId]/page.tsx
│  │  └─ me/page.tsx
│  ├─ share/[token]/page.tsx
│  └─ api/                       # API Routes
├─ components/                   # 可复用 UI
│  ├─ tree/                      # TreeCanvas, PersonCard, GenerationAxis ...
│  ├─ scroll/                    # ScrollChart
│  ├─ table/                     # DetailTable
│  ├─ book/                      # BookTemplateRenderer
│  └─ ui/                        # shadcn 生成
├─ lib/
│  ├─ api/                       # 客户端 API 封装（fetch + zod）
│  ├─ auth/
│  ├─ db.ts                      # prisma client
│  └─ services/                  # 纯逻辑：generation, kinship, layout, book
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ public/
├─ docs/
└─ tests/
   ├─ unit/
   └─ e2e/
```

## 4. 环境变量

| 变量 | 用途 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `NEXTAUTH_SECRET` | 会话加密 |
| `NEXTAUTH_URL` | 站点 URL |
| `SMTP_*` 或 `SMS_*` | 注册/邀请通知 |
| `STORAGE_*` | 头像/图片对象存储（远期） |

## 5. 浏览器与端兼容

- 桌面：Chrome / Edge / Safari / Firefox 最新两个版本
- 移动浏览器：iOS Safari 16+，Android Chrome 最新两个版本
- 微信内置浏览器（兼容到分享 H5 场景）

## 6. 依赖治理

- 仅引入必要依赖；新增 ≥ 50KB 的包需评审
- 锁定 lockfile（pnpm）
- 每月一次依赖更新窗口（远期自动化）

## 7. 不采用 / 待评估

- **GraphQL**：一期 REST 已足够，未来开放第三方对接时再评估
- **微服务拆分**：单族数据量小，单体足以；不做过早拆分
- **服务端渲染整族大图**：一期前端渲染 + 客户端导出 PDF；超大族（5000+）再考虑后端预渲染
