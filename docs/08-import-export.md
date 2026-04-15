# 导入导出与互通

## 1. GEDCOM

### 1.1 导入流程

1. 用户上传 `.ged` → 临时存储。
2. Worker 流式解析；写入 `import_staging_person` / `import_staging_fam` 等。
3. 生成 **校验报告**：无法映射的标签、循环引用、重复 `INDI`。
4. 用户确认「外部 ID → 内部字段映射」与冲突策略（跳过/新建/合并候选）。
5. 分批事务写入生产表；记录 `person_external_id`。

### 1.2 导出

- 选择子树或全空间；标注 GEDCOM 版本与丢失的内部字段说明文件（sidecar README 或 JSON）。

## 2. 表格（Excel/CSV）

- 提供**官方模板**列定义与示例行。
- 导入向导：列映射 UI、类型校验、预览 100 行。
- 大表：异步任务 + 邮件/站内通知完成。

## 3. 备份与恢复

- **空间全量导出**（管理员）：JSON Lines 或 SQL dump；含媒体 manifest 与分别打包下载。
- **恢复**：新空间导入或覆盖模式（极高风险，需冷却期与二次输入空间名确认）。

## 4. API 互操作

- 增量：`If-Match` / `updated_at` 乐观锁防止覆盖。
- Webhook 负载含 `tenant_id`, `resource`, `action`, `ids`, `occurred_at`。

## 5. 媒体迁移

- 导入仅引用 URL 时：后台抓取到自有存储（注意版权与 robots）；失败记入报告。
