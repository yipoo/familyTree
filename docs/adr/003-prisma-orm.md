# ADR 003：采用 Prisma 作为唯一 ORM

- 状态：已接受
- 日期：2026-04-15

## 背景

项目在 Next.js + PostgreSQL 已定前提下，需选定数据访问与迁移工具，避免多套迁移源导致 schema 漂移。

## 选项

1. **Prisma** + Prisma Migrate：声明式 `schema.prisma`、生成类型、与 Next 服务端常见搭配成熟。
2. **Drizzle ORM** + drizzle-kit：更贴近 SQL、包体更轻；团队需更多手写 SQL 与迁移纪律。
3. **Kysely / 纯 pg** 等：灵活高、样板与迁移成本由项目自行承担。

## 决策

采用 **选项 1：Prisma** 作为**唯一** ORM 与迁移工具。

- 表结构变更一律经 Prisma Migrate；审查时同时看 `schema.prisma` 与 `migrations/`。
- 禁止在同一仓库并行使用 Drizzle Kit 等第二套迁移链。

## 后果

- 极复杂查询可能使用 `$queryRaw`（必须参数化）或数据库视图 + Prisma `view` 映射（视版本能力），避免在业务层散落字符串 SQL。
- Serverless 部署须配置连接池或 Prisma Accelerate / Neon pooler，控制连接风暴（与 ADR 002、`12-tech-stack.md` 一致）。

## 相关文档

- `docs/12-tech-stack.md` §2
