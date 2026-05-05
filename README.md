# 家谱系统（familyTree）

Web 一期：基于 Next.js 16 + Auth.js v5 + Prisma 7 + PostgreSQL 的家族族谱协同管理系统。

## 快速开始

```bash
# 安装依赖
pnpm install

# 同步生产库 schema（针对 .env 中的 DATABASE_URL）
pnpm db:migrate

# 开发
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)。

## 数据库布局：生产 / Demo 隔离

平台使用**两个 Postgres database**（可同实例）来彻底隔离真实数据与演示数据：

| 库 | env | 用途 | 谁能写 |
| --- | --- | --- | --- |
| 生产库 | `DATABASE_URL` | 真实用户、家族、审计、邀请、提交 | 应用通过 [`prisma`](lib/db.ts) 写入 |
| Demo 库 | `DATABASE_URL_DEMO` | `/share/demo` 演示家族 | **只**由 `pnpm db:demo:seed` 写入；应用通过 [`demoPrisma`](lib/db.ts) 只读 |

### 为何隔离

- `prisma/seed.ts` 会 `deleteMany` 清空所有 user/family/person —— 误在生产跑就是事故。脚本里强制只接受 `DATABASE_URL_DEMO`，物理上无法触碰生产
- Demo 数据可独立 reset，不影响生产备份节奏
- Demo 库可独立演进 schema、随便重灌

### 初始化 Demo 库（一次性）

```bash
# 1) 在你的 Postgres 里建第二个 database
psql -c 'CREATE DATABASE family_tree_demo;'

# 2) 在 .env 里加一行（DB 名按实际填）
echo 'DATABASE_URL_DEMO="postgresql://user:pass@localhost:5432/family_tree_demo"' >> .env

# 3) 把 schema 套到 demo 库 + 灌入丁氏 demo 数据
pnpm db:demo:migrate
pnpm db:demo:seed
```

之后访问 [/share/demo](http://localhost:3000/share/demo) 即可看到演示家族。

### 日常 Demo 维护

```bash
pnpm db:demo:migrate      # schema 有改动后，把同样的 migration 应用到 demo 库
pnpm db:demo:reset        # 清空 demo 并重新 seed（不影响生产）
pnpm db:demo:seed         # 仅重灌 demo 数据（保留 schema）
pnpm db:demo:studio       # Prisma Studio 打开 demo 库
```

> ⚠️ `pnpm db:seed` / `pnpm db:reset` 已被移除。任何 seed/reset 操作都需显式带 `:demo:` 前缀。


## 功能总览

### 视图与展示

- **首页 `/`**：列出"我的家族"或全部家族（SUPERADMIN）
- **家族详情 `/f/[fid]`**：概览统计卡片 + 字辈表 + 支系 + 各世代人物
- **树视图 `/f/[fid]/tree`**：基于 React Flow 的关系树
- **吊线图 `/f/[fid]/lineage`**：父系挂线传统图，支持 SVG / PDF 导出
- **册谱 `/f/[fid]/album`**：传统传记体族谱册（HTML + 服务端 PDF）
- **详细表 `/f/[fid]/table`**：一行一家庭单元
- **人物详情 `/f/[fid]/p/[pid]`**：基本资料 / 父母 / 婚配 / 子女 / 兄弟姐妹 / 迁徙 / 居住地继承解析 / 审计日志
- **高级搜索 `/f/[fid]/search`**：多维过滤
- **分享访问 `/share/[token]`**：只读链接（可选密码 / 子树 / 有效期）

### 数据管理（族长 / 管理员）

`/f/[fid]/admin` 路由组：

- 成员 / 邀请码 / 子树管理员 / 分享链接
- 字辈表（含影响预览）
- 居住地字典
- 待审提交（普通成员通过 PendingSubmission 走审核流）
- 支系迁徙
- **数据导入 `/admin/import`**：Web 端 .xlsx 上传 + 干跑预估 + 应用导入
- **审计日志 `/admin/audit`**：写操作 before/after 详情

### 后台（SUPERADMIN）

`/admin` 路由：用户管理 / 跨家族管理。

## REST API 索引

完整目录见 `docs/04-api-design.md`。本次新增/扩展：

### 资源

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET / POST | `/api/families` | 家族列表 / 创建 |
| GET / POST / DELETE / PATCH | `/api/families/[fid]/share-links[/:id]` | 分享链接 CRUD |
| GET / POST / PATCH / DELETE | `/api/families/[fid]/marriages[/:id]` | 婚配 CRUD |
| GET / POST / PATCH / DELETE | `/api/families/[fid]/parent-child[/:id]` | 亲子关系 CRUD（防环 / 唯一性） |
| GET / POST / PATCH / DELETE | `/api/families/[fid]/migrations[/:id]` | 迁徙记录 CRUD |
| GET / POST / PATCH / DELETE | `/api/families/[fid]/generations[/:gen]` | 字辈表 + 影响预览 |
| GET / POST / PATCH / DELETE | `/api/families/[fid]/members[/:userId]` | 成员（含 OWNER 转让） |
| GET / POST / DELETE | `/api/families/[fid]/invites[/:id]` | 邀请码 |
| GET | `/api/families/[fid]/audit` | 审计日志（游标分页） |
| GET | `/api/families/[fid]/stats` | 族级统计 |

### 视图与导出

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/families/[fid]/graph` | 树视图布局 |
| GET | `/api/families/[fid]/lineage-chart` | 吊线图布局 |
| GET | `/api/families/[fid]/lineage-chart/pdf` | 吊线图 PDF（@react-pdf/renderer） |
| GET | `/api/families/[fid]/detail-table` | 详细图（家庭单元） |
| GET | `/api/families/[fid]/album/pdf` | 册谱 PDF（A4 竖版分页） |
| GET | `/api/families/[fid]/export?format=...` | 导出 JSON / CSV / GEDCOM 5.5.1 |
| GET | `/api/families/[fid]/persons/advanced-search` | 高级搜索 |

### 数据导入

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/families/[fid]/import/xlsx` | Excel 上传（multipart）；mode=dry/apply |

所有写操作：

- 必经 `lib/auth/guard.ts` 角色守卫
- 必有 Zod 入参校验（`lib/api/error.ts` 统一格式化）
- 必落 AuditLog（`lib/services/audit.ts`）

## 登录方式

- **手机号 + 密码**（默认）
- **邮箱 + 密码**（新）
- **手机号 + 验证码**（阿里云 SMS）
- **邀请码加入**（无需审批）

## PDF 导出与中文字体

PDF 走 `@react-pdf/renderer` 服务端生成。中文字体注册顺序（`lib/pdf/fonts.ts`）：

1. 环境变量 `CJK_FONT_PATH`
2. macOS 内置：`Hiragino Sans GB.ttc` / `STHeiti Light.ttc` / `Songti.ttc`
3. Linux：`/usr/share/fonts/{opentype,truetype}/noto/NotoSansCJK-Regular.ttc`
4. 项目内置：`public/fonts/cjk.ttf`

Linux 部署时建议安装 Noto CJK 包，或在镜像中放置 `public/fonts/cjk.ttf`。

## 测试

```bash
pnpm test       # vitest run
pnpm test:watch # 交互式
```

测试覆盖关键纯算法：吊线图布局、JSON/CSV/GEDCOM 导出、册谱传记体格式化、Excel 解析。

## 常用脚本

```bash
pnpm dev              # 启动开发服务器
pnpm build            # 生产构建
pnpm lint             # ESLint
pnpm test             # 跑单测
pnpm db:migrate       # Prisma 迁移
pnpm db:seed          # 灌入种子数据
pnpm db:reset         # 重置 + 重新 seed
tsx scripts/import-xlsx.ts                 # 从 Excel 全量导入（CLI）
tsx scripts/create-admin.ts <phone> <name> # 创建 SUPERADMIN
tsx scripts/set-super.ts <phone>           # 提权为 SUPERADMIN
```

## 文档目录

- `docs/01-requirements.md` 需求
- `docs/02-architecture.md` 架构
- `docs/03-data-model.md` 数据模型（含 Prisma schema 注释）
- `docs/04-api-design.md` API 设计
- `docs/12-tech-stack.md` 技术栈说明
