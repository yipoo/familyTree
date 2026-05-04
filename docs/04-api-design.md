# API 设计

> 版本：v0.1（草案）
> 配套：`02-architecture.md`、`03-data-model.md`
> 风格：RESTful + JSON；一期实现于 Next.js API Routes（`app/api/...`）

## 1. 通用约定

### 1.1 基础
- Base URL：`/api`
- Content-Type：`application/json; charset=utf-8`
- 时间格式：ISO 8601（`2026-04-30T12:00:00Z`）
- ID：cuid 字符串

### 1.2 认证
- Cookie 会话（Auth.js / NextAuth）
- 分享链接通道：`Authorization: Bearer <share_token>`，仅授予只读权限，按 `ShareLink.scope` 限制

### 1.3 多租户
- 大多数路由嵌套于 `/api/families/:familyId/...`
- 服务端中间件：校验当前用户在该 family 内的角色；查询统一注入 `where: { familyId }`

### 1.4 响应格式

成功：
```json
{ "data": { ... } }
```
列表：
```json
{ "data": [ ... ], "page": { "nextCursor": "...", "hasMore": true } }
```
错误：
```json
{ "error": { "code": "FORBIDDEN", "message": "..." } }
```

错误码：`UNAUTHENTICATED` `FORBIDDEN` `NOT_FOUND` `VALIDATION_FAILED` `CONFLICT` `RATE_LIMITED` `INTERNAL`

### 1.5 分页
- Cursor 分页：`?cursor=<id>&limit=50`（默认 50，最大 200）

### 1.6 幂等
- 写操作支持 `Idempotency-Key` 请求头（创建类操作）

---

## 2. 认证与账户

| 方法 | 路径 | 描述 |
|---|---|---|
| POST | `/api/auth/register` | 邮箱/手机号注册 |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 登出 |
| GET  | `/api/me` | 当前用户信息 + 所属家族列表 |
| PATCH | `/api/me` | 更新昵称、头像 |

---

## 3. 家族（Family）

| 方法 | 路径 | 角色 | 描述 |
|---|---|---|---|
| POST | `/api/families` | 任意登录用户 | 创建家族（成为 Owner），需提交完整字辈表 |
| GET  | `/api/families/:fid` | 成员 | 家族基本信息 + 统计 |
| PATCH | `/api/families/:fid` | Owner/Admin | 更新名称、描述等 |
| DELETE | `/api/families/:fid` | Owner | 删除（软删） |

创建家族请求体：
```json
{
  "surname": "丁",
  "name": "丁氏家族",
  "founderName": "始祖名",
  "generationNames": [
    { "generation": 1, "character": "..." },
    { "generation": 2, "character": "..." }
  ]
}
```

---

## 4. 字辈表（固定，仅纠错性修订）

| 方法 | 路径 | 角色 | 描述 |
|---|---|---|---|
| GET | `/api/families/:fid/generation-names` | 成员 | 列出字辈表 |
| PATCH | `/api/families/:fid/generation-names` | Admin | 批量修订字辈（需提供受影响人物预览） |

PATCH 行为：返回受影响 `Person.generationChar` 的数量与样例，前端二次确认后再提交 `?confirm=true`。

---

## 5. 成员与权限

| 方法 | 路径 | 角色 | 描述 |
|---|---|---|---|
| GET | `/api/families/:fid/members` | 成员 | 成员列表 |
| POST | `/api/families/:fid/invitations` | Admin | 创建邀请（链接/二维码） |
| POST | `/api/invitations/:token/accept` | 登录用户 | 接受邀请 |
| PATCH | `/api/families/:fid/members/:uid` | Owner/Admin | 修改角色 |
| DELETE | `/api/families/:fid/members/:uid` | Owner/Admin | 移除成员 |

---

## 6. 人物（Person）

| 方法 | 路径 | 角色 | 描述 |
|---|---|---|---|
| GET | `/api/families/:fid/persons` | 成员 | 列表（支持 `?q=&generation=&branchId=&cursor=`） |
| GET | `/api/families/:fid/persons/:pid` | 成员 | 单条详情（含父母、配偶、子女摘要） |
| POST | `/api/families/:fid/persons` | Admin / Member（待审） | 新增 |
| PATCH | `/api/families/:fid/persons/:pid` | Admin | 修改 |
| DELETE | `/api/families/:fid/persons/:pid` | Admin | 软删 |

新增人物请求体：
```json
{
  "name": "维海",
  "gender": "MALE",
  "generation": 20,
  "fatherId": "...",
  "motherId": "...",
  "birthOrder": 2,
  "birthYear": null,
  "branchId": "..."
}
```

服务端会校验：
- `generation == father.generation + 1`（招赘场景按女方一侧）
- `generationChar` 自动写入

---

## 7. 关系

### 7.1 婚姻

| 方法 | 路径 | 描述 |
|---|---|---|
| GET | `/api/families/:fid/persons/:pid/marriages` | 该人的所有婚姻 |
| POST | `/api/families/:fid/marriages` | 新建婚姻 |
| PATCH | `/api/families/:fid/marriages/:mid` | 修改（含原配/继配/入赘） |
| DELETE | `/api/families/:fid/marriages/:mid` | 删除 |

请求体：
```json
{
  "husbandId": "...",
  "wifeId": "...",
  "type": "PRIMARY | SECONDARY | UXORILOCAL",
  "order": 1,
  "marriedYear": 1985
}
```

### 7.2 亲子

| 方法 | 路径 | 描述 |
|---|---|---|
| POST | `/api/families/:fid/parent-child` | 建立父/母 — 子女关系 |
| PATCH | `/api/families/:fid/parent-child/:id` | 修改（关系类型、排行） |
| DELETE | `/api/families/:fid/parent-child/:id` | 删除 |

---

## 8. 支系与迁徙

### 8.1 支系
| 方法 | 路径 | 描述 |
|---|---|---|
| GET | `/api/families/:fid/branches` | 支系列表 |
| POST | `/api/families/:fid/branches` | 新建支系（指定根人物 + 现住地） |
| PATCH | `/api/families/:fid/branches/:bid` | 修改 |
| DELETE | `/api/families/:fid/branches/:bid` | 删除 |

### 8.2 迁徙（个人/支系两级）
| 方法 | 路径 | 描述 |
|---|---|---|
| GET | `/api/families/:fid/migrations` | 列表（支持 `?scope=BRANCH|PERSON&branchId=&personId=`） |
| POST | `/api/families/:fid/migrations` | 新增 |
| PATCH | `/api/families/:fid/migrations/:mid` | 修改 |
| DELETE | `/api/families/:fid/migrations/:mid` | 删除 |

---

## 9. 图查询（树谱核心接口）

```
GET /api/families/:fid/graph
    ?mode=paternal | maternal | kin5 | all
    &center=:personId
    &branchId=:bid
```

返回：
```json
{
  "data": {
    "persons":  [ {...精简人物} ],
    "marriages":[ {...精简婚姻} ],
    "parentChild":[ {...} ],
    "generationNames":[ {...} ],
    "branches":[ {...} ],
    "migrations":[ {...} ],
    "stats": { "total": 134, "male": 107, "female": 27 }
  }
}
```

服务端职责：
- `mode=kin5`：以 `center` 为中心做 5 代上下 BFS 过滤
- `mode=paternal/maternal`：仅保留父系/母系链路
- 单次返回，前端就地渲染，避免 N+1

---

## 10. 详细图与吊线图

| 方法 | 路径 | 描述 |
|---|---|---|
| GET | `/api/families/:fid/detail-table` | 返回家庭单元行（按 `02-architecture §6.3` 构造） |
| GET | `/api/families/:fid/scroll-chart` | 返回吊线图布局（节点 + 连线 + 世代轴） |

支持 `?branchId=`、`?fromGeneration=&toGeneration=` 过滤。

---

## 11. 册谱与导出

| 方法 | 路径 | 描述 |
|---|---|---|
| GET | `/api/families/:fid/book/templates` | 模板列表 |
| POST | `/api/families/:fid/book/render` | 触发渲染（同步返回 PDF 流，远期改异步） |
| GET | `/api/families/:fid/export?format=json\|excel\|gedcom` | 导出 |
| POST | `/api/families/:fid/import` | 导入（multipart/form-data） |

渲染请求体：
```json
{
  "templateId": "classic-vertical",
  "scope": { "branchId": "..." },
  "options": { "paperSize": "A3", "includeMigrations": true }
}
```

---

## 12. 分享链接

| 方法 | 路径 | 描述 |
|---|---|---|
| POST | `/api/families/:fid/share-links` | 创建只读分享 |
| GET | `/api/share/:token` | 通过 token 访问家族（只读） |
| DELETE | `/api/families/:fid/share-links/:id` | 撤销 |

`scope` 字段：
```json
{ "type": "FULL" }
{ "type": "BRANCH", "branchId": "..." }
{ "type": "PERSON_SUBTREE", "personId": "...", "depth": 5 }
```

---

## 13. 审核（普通成员补录）

| 方法 | 路径 | 描述 |
|---|---|---|
| POST | `/api/families/:fid/submissions` | 成员提交补录草稿 |
| GET | `/api/families/:fid/submissions?status=PENDING` | 管理员查看待审 |
| POST | `/api/families/:fid/submissions/:sid/approve` | 审核通过（写入正式数据） |
| POST | `/api/families/:fid/submissions/:sid/reject` | 拒绝 |

---

## 14. 审计日志

| 方法 | 路径 | 描述 |
|---|---|---|
| GET | `/api/families/:fid/audit-logs?cursor=&entity=&actorId=` | Owner/Admin 查看变更历史 |

---

## 15. 限流与配额（远期）

- 写接口：60 次 / 分钟 / 用户
- 导出与渲染：5 次 / 小时 / 家族
- 超限返回 `429` + `RATE_LIMITED`

---

## 16. 版本与兼容

- API 版本通过路径 `/api/v1/...` 引入（一期暂用 `/api/...`，二期对外开放前再迁移）
- 字段新增视为非破坏性，删除/重命名需新版本
