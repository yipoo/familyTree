# API 设计纲要

本文档约定 REST 风格、资源划分与横切行为；OpenAPI 3.1 规范建议由代码生成或手写 YAML 与本节同步。

## 1. 基础约定

| 项 | 约定 |
|----|------|
| 前缀 | `/api/v1` |
| 格式 | `Content-Type: application/json`；文件上传 `multipart/form-data` |
| 认证 | `Authorization: Bearer <access_token>` 或 Cookie Session |
| 租户 | 路径嵌入 `/tenants/{tenantId}/...` **或** Header `X-Tenant-Id`（二选一全局统一） |
| 分页 | `?cursor=` 游标优先；兼容 `?page=&page_size=`（上限 100） |
| 幂等 | 写操作支持 `Idempotency-Key` UUID |
| 时间 | ISO 8601 UTC 存储，响应可带 `X-User-Timezone` 解释字段 |

## 2. 错误模型

```json
{
  "error": {
    "code": "FORBIDDEN_FIELD",
    "message": "人类可读的说明",
    "details": [{ "field": "phone", "reason": "insufficient_scope" }],
    "trace_id": "..."
  }
}
```

HTTP 状态：400 参数、401 未认证、403 无权限、404 资源不存在或**无权时伪装 404**（敏感资源可选策略）、409 业务冲突、429 限流。

## 3. 资源分组

### 3.1 认证与用户

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`
- `POST /auth/mfa/setup`, `POST /auth/mfa/verify`
- `GET /me`, `PATCH /me`

### 3.2 空间与成员

- `GET/POST /tenants`, `GET/PATCH /tenants/{id}`
- `GET /tenants/{id}/members`, `POST /tenants/{id}/invitations`
- `PATCH /tenants/{id}/members/{userId}`, `DELETE ...`（撤销）

### 3.3 人员与关系

- `GET/POST /tenants/{id}/persons`
- `GET/PATCH/DELETE /tenants/{id}/persons/{personId}`
- `GET /tenants/{id}/persons/{personId}/relationships`
- `POST/DELETE /tenants/{id}/relationships`
- `POST /tenants/{id}/persons:merge`（body：源、目标、字段映射）→ 返回 `job_id`

### 3.4 树与子图

- `GET /tenants/{id}/trees/subtree?rootPersonId=&maxDepth=&direction=`
- `GET /tenants/{id}/persons:search?q=&filters=`

### 3.5 事件与地点

- `GET/POST /tenants/{id}/events`
- `GET/PATCH/DELETE /tenants/{id}/events/{eventId}`
- `GET/POST /tenants/{id}/places`

### 3.6 媒体

- `POST /tenants/{id}/media:uploadUrl` → 预签名 PUT
- `POST /tenants/{id}/media` 完成回调并绑定关联

### 3.7 协作

- `GET/POST /tenants/{id}/change-requests`
- `POST /tenants/{id}/change-requests/{id}:approve|:reject`
- `GET/POST .../comments`（多态 `subjectType`, `subjectId`）

### 3.8 统计

- `GET /tenants/{id}/stats/overview?filter=...`
- `GET /tenants/{id}/stats/timeseries?metric=birth_decade&...`
- `POST /tenants/{id}/stats/recompute`（管理员；可选）

### 3.9 导入导出与版本

- `POST /tenants/{id}/imports:gedcom`, `GET /tenants/{id}/imports/{jobId}`
- `POST /tenants/{id}/exports:persons`, `:stats-report`
- `GET/POST /tenants/{id}/pedigree-snapshots`

## 4. 筛选器 DSL（建议）

统一 `filter` JSON 或 query 编码，例如：

```json
{
  "branchRootPersonId": "uuid",
  "living": "any|yes|no",
  "birthYearRange": [1900, 2000],
  "tags": ["房支:长房"]
}
```

统计与列表共用同一解析器，避免行为不一致。

## 5. 版本演进

- URL 版本 `v1` → 破坏性变更升 `v2`；旧版保留窗口期。
- 响应头 `Deprecation` / `Sunset`（RFC）用于标记弃用端点。

## 6. Webhook（可选）

- 事件类型：`person.updated`, `relationship.created`, …
- 投递：带签名 `X-Signature: sha256=...`；重试指数退避。
