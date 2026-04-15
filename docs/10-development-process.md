# 研发流程

## 1. 分支策略

- `main`：可发布；保护分支，需 PR + CI 通过。
- `develop`（可选）：集成分支。
- 功能分支：`feat/...`, 修复：`fix/...`, 文档：`docs/...`。

## 2. Code Review

- 至少一名审阅者；权限与安全相关改动需额外标签 `security-review`。

## 3. 文档同步规则

- 行为变更：更新 `01-requirements.md` 与/或 `04-api-design.md`。
- 表结构变更：更新 `03-data-model.md` + 迁移文件。
- 架构变更：更新 `02-architecture.md` 或新增 `docs/adr/NNN-*.md`。

## 4. 提交信息

- Conventional Commits：`feat:`, `fix:`, `docs:`, `chore:`。
- 关联 Issue / 任务 ID（若有）。

## 5. 发布前检查清单

- [ ] 迁移已在 staging 执行并验证回滚脚本（若有）
- [ ] OpenAPI / 客户端类型已更新
- [ ] 新环境变量已写入部署文档与密钥管理
- [ ] 统计与权限相关 E2E 通过
- [ ] 变更日志（CHANGELOG）已更新

## 6. 本地开发

- **PostgreSQL**：本机安装；创建数据库 **`family_tree_db`**，`.env` 中配置 `DATABASE_URL`（格式见 `12-tech-stack.md` §11）。
- **其他依赖**：`docker compose up` 拉起 Redis 等（待仓库提供 compose 文件后与此节对齐）。
- Seed 数据：小型虚构家族树用于 UI 与统计演示。

## 7. ADR

架构权衡使用 `docs/adr/README.md` 索引；每条 ADR 独立文件，禁止静默改历史 ADR 正文（可追加「废止」段）。
