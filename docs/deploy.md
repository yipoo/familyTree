# 部署与运维手册

> 本指南覆盖：本地起步、Postgres 准备、迁移与种子、生产部署（systemd / pm2 / Docker 三选一）、备份策略、env 变量速查与 FAQ。

## 0. 快速开始（本地）

```bash
# 1) 装依赖（pnpm 10+）
pnpm install

# 2) 起 Postgres（任何方式都行，下面给一个 Docker 一行流）
docker run -d --name fmt-pg \
  -e POSTGRES_USER=family -e POSTGRES_PASSWORD=family \
  -e POSTGRES_DB=family_tree \
  -p 5432:5432 postgres:16

# 3) 复制 env 模板并填值
cp .env.example .env
# 至少把 DATABASE_URL 和 AUTH_SECRET 填好

# 4) 应用 schema 到数据库
pnpm db:migrate

# 5) （可选）初始化 Demo 库与演示数据
psql -h localhost -U family -d postgres -c 'CREATE DATABASE family_tree_demo;'
echo 'DATABASE_URL_DEMO="postgresql://family:family@localhost:5432/family_tree_demo"' >> .env
pnpm db:demo:migrate
pnpm db:demo:seed

# 6) 起 dev server
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)，注册或邀请码加入即可。

## 1. PostgreSQL 准备

### 推荐版本与扩展

- Postgres 14+（项目使用 cuid / 标准 SQL 类型，对版本不敏感）
- 不需要 PostGIS / pg_trgm 等额外扩展

### 用户与库

```sql
-- 在 superuser psql 里执行
CREATE USER family WITH PASSWORD '<strong-random>';
CREATE DATABASE family_tree OWNER family;
CREATE DATABASE family_tree_demo OWNER family;
```

### 连接串规范

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

生产环境强烈建议加 `sslmode=require`。

### 索引与体积

10580 人规模实测，单库 < 100 MB。已为以下高频组合建索引：

- `Person(familyId, generation)` / `Person(familyId, branchId)` / `Person(familyId, name)`
- `ParentChild(familyId, parentId)` / `ParentChild(familyId, childId)`
- `Marriage(familyId, husbandId)` / `Marriage(familyId, wifeId)`
- `AuditLog(familyId, createdAt)` —— 审计页面按时间倒序分页

PdfJob、Family.deletedAt 软删过滤等新增索引由迁移文件 `20260505_*_p0p1p2_complete` 一并创建。

## 2. 迁移与种子

### 迁移

```bash
# 开发：自动生成新 migration（改 schema 后）
pnpm db:migrate

# 生产：仅应用已有 migration（不会询问）
DATABASE_URL=$DATABASE_URL pnpm exec prisma migrate deploy
```

### 种子（仅 demo 库）

```bash
pnpm db:demo:seed     # 灌入丁氏家族 demo 数据，会清空原有 demo 数据
```

`prisma/seed.ts` 内置硬性检查：必须传 `DATABASE_URL_DEMO`，且不可与 `DATABASE_URL` 相同——所以**永远不会跑到生产库**。

### 创建第一个超级管理员

```bash
DATABASE_URL=$DATABASE_URL pnpm exec tsx scripts/create-admin.ts <phone> <name>
# 或对已存在用户提权
DATABASE_URL=$DATABASE_URL pnpm exec tsx scripts/set-super.ts <phone>
```

## 3. 生产部署

### 选项 A. systemd（最简单）

```bash
# 在服务器 build 一次
pnpm install --prod=false
pnpm build

# /etc/systemd/system/family-tree.service
[Unit]
Description=family-tree
After=network.target

[Service]
WorkingDirectory=/opt/family-tree
EnvironmentFile=/opt/family-tree/.env
ExecStart=/usr/bin/pnpm start
Restart=on-failure
User=family
Group=family

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now family-tree
sudo systemctl status family-tree
```

### 选项 B. pm2

```bash
pnpm build
pm2 start "pnpm start" --name family-tree
pm2 save
pm2 startup     # 跟提示注册成开机自启
```

`.env` 与 cwd 由 pm2 启动用户继承。

### 选项 C. Docker

最小化 Dockerfile（项目暂未提供官方 Dockerfile，按需添加）：

```dockerfile
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:20-bookworm-slim
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
# 中文字体（PDF 渲染需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-cjk && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/lib/generated ./lib/generated
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["pnpm", "start"]
```

容器内迁移：

```bash
docker run --rm --env-file .env family-tree:latest \
  pnpm exec prisma migrate deploy
```

### 反向代理建议

- Nginx / Caddy 前置 TLS、压缩、长连接
- 把 `/api/families/*/lineage-chart/pdf` `/album/pdf` 单独配 600s 超时（即便已异步化，下载阶段也不要被代理掐断）
- 静态资源走 CDN（Next 16 的 `_next/static` 永久缓存友好）

## 4. PDF 异步任务

10580 人级别的吊线图 / 册谱已**异步化**：

- 客户端 POST `/api/families/[fid]/lineage-chart/pdf` 或 `/album/pdf` → 拿到 `{ jobId }`
- 轮询 GET `/api/families/[fid]/pdf-jobs/[jobId]` 直到 status=DONE / FAILED
- DONE 后 GET `/api/families/[fid]/pdf-jobs/[jobId]/download` 直接拉文件

旧链接（直接 GET PDF）保持兼容：当 family 人数 < 阈值 N=300 时同步生成；超过自动 302 到异步流程。

队列实现见 `lib/services/pdf-queue.ts`，并发上限 1，避免内存峰值。后续如需多实例，把内存 queue 替换成 BullMQ + Redis 即可（接口已抽象）。

## 5. 备份策略

### 数据库

```bash
# 定时全量（cron 每日 02:00）
pg_dump -Fc -h DB_HOST -U family family_tree > "backup-$(date +%F).dump"

# 上传到对象存储或异地
aws s3 cp backup-$(date +%F).dump s3://family-tree-backups/
```

恢复：

```bash
pg_restore -h DB_HOST -U family -d family_tree -c backup-2026-05-05.dump
```

### 上传文件 / 头像

当前实现头像 / PDF 输出尚未持久化到对象存储（一期内 PDF 即时下载）。如启用持久化，见 P2 待办。

## 6. 监控与日志

### 应用日志

- `pnpm start` 走 stdout/stderr，systemd 用 journalctl 收集，docker 用 `docker logs`
- 后端错误统一过 `lib/api/error.ts:handleApiError` → console.error 打印 `[api] ...` 前缀
- 限流命中 → 429 + `X-RateLimit-Bucket` header（运维可在反向代理日志里抓）

### 健康检查

简单做法：让监控请 `/api/auth/session`，200 表示进程存活 + Auth.js + Prisma 都正常。

## 7. env 变量速查

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | 主库连接串 |
| `AUTH_SECRET` | ✅ | Auth.js JWT 密钥（生产）。`openssl rand -base64 32` |
| `DATABASE_URL_DEMO` | ⛔ 仅 demo | Demo 库；与主库物理隔离 |
| `BASE_URL` | ⛔ | 部分脚本依赖，默认 `http://localhost:3010` |
| `ALIYUN_SMS_ACCESS_KEY_ID` | ⛔ | 阿里云短信 AK；缺则 dev fallback |
| `ALIYUN_SMS_ACCESS_KEY_SECRET` | ⛔ | 阿里云短信 SK |
| `ALIYUN_SMS_SIGN_NAME` | ⛔ | 短信签名 |
| `ALIYUN_SMS_TEMPLATE_LOGIN` | ⛔ | 登录验证码模板编号 |
| `ALIYUN_SMS_ENDPOINT` | ⛔ | 默认 `dysmsapi.aliyuncs.com` |
| `CJK_FONT_PATH` | ⛔ | PDF 中文字体回退路径；默认尝试系统字体 |
| `NEXT_BUILD_DIR` | ⛔ | 自定义 `.next` 输出目录 |

## 8. 常见问题

### Q: PDF 中文显示为方框 / 乱码

A: 服务器没有 CJK 字体。装一套：

```bash
# Debian / Ubuntu
apt-get install -y fonts-noto-cjk

# 或在镜像里放
COPY ./assets/cjk.ttf /opt/family-tree/public/fonts/cjk.ttf

# 或最直接：
export CJK_FONT_PATH=/path/to/your.ttf
```

### Q: `pnpm db:migrate` 报 `P1010: User ... was denied access`

A: 数据库用户没建库 / 写 schema 权限。`GRANT ALL PRIVILEGES ON DATABASE family_tree TO family;` 或者直接让该用户成为库 owner。

### Q: 限流命中后想看哪个桶

A: 看 429 响应头 `X-RateLimit-Bucket`：login / login-code / register / sms-send / export / import-xlsx / pdf-lineage / pdf-album / pdf-job-create。

### Q: Excel 导入 60s 超时

A: `app/api/families/[familyId]/import/xlsx/route.ts` 已设 `maxDuration = 300`。如部署在 Vercel Pro 之外的限时平台，可拆成"上传 → 后台 worker"。

### Q: 注册不收短信

A: 检查 `ALIYUN_SMS_*` 是否齐全。`NODE_ENV=development` 时控制台会直接打印验证码，方便联调。

### Q: 想关闭"自动注册新用户"

A: 改 `app/api/login-code/route.ts`，把没注册的分支改成返回错误而非创建 user。

## 9. 升级路径

每次拉取新版本：

```bash
git pull
pnpm install
pnpm exec prisma migrate deploy
pnpm build
sudo systemctl restart family-tree   # 或 pm2 reload family-tree
```

升级前最好先 `pg_dump` 一份备份（见第 5 节）。
