# 运维与部署

## 1. 环境

| 环境 | 用途 |
|------|------|
| local | 开发者本机；**PostgreSQL 使用本机实例**，库名约定 **`family_tree_db`**（见 `12-tech-stack.md` §11）；Redis/MinIO 可用 Docker Compose；`next dev` |
| staging | 预发；匿名化副本或合成数据；`next build` + `next start` 或与生产一致镜像 |
| production | 生产 |

Web 与 Worker 的进程划分见 **`12-tech-stack.md`**（Next 不承载 GEDCOM/PDF 等长任务）。

## 2. 配置管理

- 十二因子：配置环境变量注入；禁止密钥入库。
- 功能开关：按租户或全局（如「开放注册」）。

## 3. 数据库

- 迁移：CI 中 dry-run；生产人工审批。
- 备份：连续 WAL 归档 + 日全量；定期恢复演练（季度）。
- 大表维护：`VACUUM`/`ANALYZE` 窗口；分区表评估（审计日志按时间分区）。

## 4. 对象存储

- 生命周期：临时上传 7 天清理；导出文件 24h–7d 可配置。
- CORS：仅前端域名。

## 5. 队列与 Worker

- 队列：Redis Stream / SQS / RabbitMQ（择一）；**死信队列**与告警。
- 并发：每租户导入单飞（互斥锁）避免 DB 热点。

## 6. 观测

- 日志聚合：Loki / ELK；指标：Prometheus + Grafana。
- 告警：5xx 率、队列积压、p95 延迟、磁盘使用率。

## 7. 容量规划（量级参考）

| 规模 | 建议 |
|------|------|
| 人员 &lt; 5k | 单 DB 实例 + 同步统计 |
| 5k–50k | 只读副本、统计快照、树分页必选 |
| 媒体 TB 级 | CDN 回源对象存储；图片多分辨率 |

## 8. 灾难恢复

- RPO/RTO 目标文档化；跨区复制（云厂商功能）。
- 运行手册：「DB 主故障切换步骤」一页纸。
