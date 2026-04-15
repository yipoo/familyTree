# 家谱 Web 项目文档索引

本目录存放产品设计、架构与研发过程文档，开发阶段以本文档为单一事实来源（SSOT）的入口，随实现迭代同步更新。

## 阅读顺序

| 序号 | 文档 | 说明 |
|------|------|------|
| 00 | [产品概述与术语](./00-overview.md) | 定位、范围、术语表 |
| 01 | [功能需求规格](./01-requirements.md) | 全量功能清单与规则 |
| 02 | [系统架构](./02-architecture.md) | **总体架构、组件、数据流、技术选型原则** |
| 03 | [数据模型](./03-data-model.md) | 实体、关系、索引与一致性 |
| 04 | [API 设计纲要](./04-api-design.md) | REST 资源、约定、版本与错误码 |
| 05 | [安全与隐私](./05-security-privacy.md) | 认证、权限、审计、合规要点 |
| 06 | [前端架构](./06-frontend-architecture.md) | 应用结构、家谱渲染、状态与性能 |
| 07 | [统计与报表](./07-statistics.md) | 指标定义、筛选维度、数据质量 |
| 08 | [导入导出与互通](./08-import-export.md) | GEDCOM、CSV、备份策略 |
| 09 | [运维与部署](./09-operations.md) | 环境、观测、备份、容量 |
| 10 | [研发流程](./10-development-process.md) | 分支、评审、文档与发布检查清单 |
| 11 | [信息架构](./11-information-architecture.md) | 导航、路由、页面树 |
| 12 | [技术栈](./12-tech-stack.md) | **Next.js + PostgreSQL + Prisma** 与配套选型 |
| ADR | [架构决策记录](./adr/README.md) | 重大权衡的提议与结论 |

## 维护约定

- 架构或数据模型变更时，必须同步更新 `02-architecture.md` 与 `03-data-model.md`；技术组件变更同步 `12-tech-stack.md` 并视情况新增 ADR。
- 对外行为以 `01-requirements.md` 与 `04-api-design.md` 为准；实现偏差需在 PR 中说明并回写文档。
