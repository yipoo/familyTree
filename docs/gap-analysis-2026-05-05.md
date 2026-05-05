# 差距分析（v2，2026-05-05）

> 与 `01-requirements.md` / `02-architecture.md` / `03-data-model.md` / `04-api-design.md` / `12-tech-stack.md` 对照，盘点 P0+P1 完工后**仍未做** / **未完整做**的部分。
> 范围：纯调研，不写代码、不动 lint。

---

## 1. 文档承诺 vs 现状（功能维度）

### 1.1 ✅ 已完成

- 字辈表录入与修订（含影响预览 / `applyToPersons`）
- 人物 CRUD（POST/GET-by-id/PATCH/DELETE-soft）
- 婚配 CRUD（PRIMARY/SECONDARY/CONCUBINE/UXORILOCAL）
- 亲子 CRUD（带防环、isPrimary、过继）
- 迁徙记录（个人级 + 支系级）
- 居住地继承（`PersonLocation` + `residenceId` + 解析器）
- 树谱（React Flow）+ 世代轴 + 头像 + 性别色
- 树谱筛选（地理位置 / 字辈 / 世代 / 性别 / 状态）
- 间距三档（紧凑/适中/宽松）+ 滚轮模式可配
- 人物详情页 `/f/[fid]/p/[pid]`
- 高级搜索 `/api/.../persons/advanced-search`
- 吊线图 + PDF 导出（`@react-pdf/renderer`）
- 详细图（家庭单元）+ 独立 API
- 册谱（HTML 预览 + 服务端 PDF）
- 导出 JSON / CSV / GEDCOM 5.5.1
- Excel 导入（dry-run + apply）
- 邀请码（FamilyInvite，多种 TTL / uses）
- 分享链接 ShareLink（含密码、过期、subtree scope）
- 审计日志（统一 `writeAudit` 包装，含 admin 查看页）
- 邮箱+密码 / 手机号+密码 / 手机号验证码三种登录
- 子树管理员（SubtreeAdmin）+ 父系链鉴权
- 待审提交（PendingSubmission，含 approve/reject/withdraw）
- 平台 SUPERADMIN + `/admin/*` 后台
- 关键纯算法单测（24 用例：tree-spacing / lineage-chart / exporters / album / xlsx-import / tree-filter）
- UI 设计语言 v2 + 主题三态 + 全新 TopNav + 移动审计修复
- 真机数据截图归档 `docs/ui-screenshots`（10580 人 × 24 代）
- demo 库与生产库物理隔离 + `pnpm db:demo:*` 全套脚本

### 1.2 🟡 部分完成（描述缺口）

| 项 | 文档章节 | 现状 | 缺口 |
|---|---|---|---|
| **家族资源 CRUD** | 04 §3 | `POST /api/families`（创建）、`GET /api/families`（列表）✅ | **缺 `GET /api/families/[fid]`**（单条）、**`PATCH`**（改名 / 描述）、**`DELETE`**（软删，schema 有 `deletedAt` 字段但无路由）。`/f/[fid]/page.tsx` 直接走 prisma SSR 绕过了 API |
| **人物列表** | 04 §6 | 只有 POST（新增）；查询走 `/persons/search` 与 `/persons/advanced-search` | 文档承诺的 `GET /persons?q=&generation=&branchId=&cursor=` 没单独路由；目前两个搜索路由功能更全，但**没游标分页约定**（`limit≤200`、cursor），不符合 04 §1.5 |
| **支系（Branch）API** | 04 §8.1 | schema 有 Branch model；导入 / 详情/统计页能读它 | **完全没有 `/api/families/[fid]/branches[*]` 路由**。"创建支系" "改名" "删支系" 全部缺失，UI 也没有创建支系入口 |
| **册谱模板系统** | 01 §3.6.4 / 02 §6.5 / 04 §11 | 有"传记体单一布局"的 `album/pdf` | **没有 `GET /book/templates` 列表，也没有 `POST /book/render` 选模板渲染**。文档承诺"2-3 套模板（古典竖排 / 现代横排 / 简约）"，目前只有一种硬编码模板 |
| **图查询的 mode 参数** | 04 §9 | `/graph` 已支持 `lineage=paternal\|maternal\|all` + `root` + `focus+upGen` | **`mode=kin5`（近亲 5 代过滤）** 未实现。01 §3.6 树谱顶部过滤、02 §6.2 都明确要求"以当前选定人物为中心上下各 5 代血缘距离" |
| **`/api/me`** | 04 §2 | 没有；前端通过 `auth()` SSR 自取 session、`/me` 页面直接 prisma | 文档承诺 `GET /api/me` 与 `PATCH /api/me`（更新昵称、头像）。改昵称/密码现在走 `/me` 上的 server action，不是 RESTful |
| **删除策略：人物软删 + 硬删（仅 Owner）** | 03 §3.5 | 软删已实现 | **缺 Owner 的硬删通道**；schema 也没办法批量恢复。生产环境长期运行后，软删遗留数据会膨胀 |
| **scrollChart API 的 generationFrom/To 过滤** | 04 §10 | `lineage-chart` 仅支持 `root` | 文档承诺的 `branchId / fromGeneration / toGeneration` 过滤未实现 |
| **导出 `format=excel`** | 04 §11 | export 路由支持 json / csv / csv-* / gedcom | excel 输出未实现（导入有，导出对称缺失） |
| **整族 Excel 多 sheet 导入** | 02 §7、04 §11 | xlsx-import 只读 `wb.worksheets[0]`，单 sheet 解析 | 文档承诺"人物表 + 关系表 + 迁徙表三 sheet"，目前依赖单表的"父亲ID/母亲ID"列，迁徙记录无法导入 |
| **API 限流 / 配额** | 04 §15 | 仅 SMS 验证码有 60s 冷却 | 文档承诺：写接口 60/分钟、导出 5/小时。**全站没有 rate limit 中间件**；`/import/xlsx`、`/album/pdf`、`/lineage-chart/pdf`、`/export` 全开放，10580 人量级 PDF 渲染 1 次约 数秒到 10s+ CPU，被滥用就是事故 |
| **二期端：移动 App / 小程序** | 01 §4.1 / 02 §3 | 仓库无 `mobile/` `miniapp/` 目录 | 文档把它列为二期，明确不在一期范围；保留为 P2，仅记录 |
| **GEDCOM 互通字段映射定稿** | 03 §6 | 导出已生成 5.5.1，单测覆盖 | 双向（GEDCOM **导入**）未做；字段映射文档也未单独整理 |
| **移动端布局参考 1.jpg 的底部 Tab** | 01 §4.1 | 已有 MobileNav，截图证实可用 | "底部 Tab 导航 + 浮动操作按钮（FAB）"——FAB 没看到 |
| **OWNER 转让家族** | 02 §5 / README API 索引 | members PATCH 注释说"含 OWNER 转让"，需要确认实测 | 没有专门的 `/api/families/[fid]/transfer-owner` 路由；如果靠把另一人改成 OWNER + 自己降级，需双步事务并审计两条 |

### 1.3 ❌ 未开始

| 项 | 文档章节 | 影响 |
|---|---|---|
| **Family 单条资源路由（GET/PATCH/DELETE）** | 04 §3 | 改名、改描述、软删整族——目前完全没出口 |
| **Branches CRUD API + UI** | 04 §8.1 | 创建/编辑支系全靠运维或导入；普通管理员无法在 UI 里新建支系 |
| **册谱模板列表 + 选择渲染** | 04 §11 | "册谱用模板" 是 01 §7 的关键决策点，仅一种实现等于没兑现 |
| **`mode=kin5` 近亲 5 代过滤** | 04 §9 / 01 §3.6 / 02 §6.2 | 树谱的关键体验"以当前人为中心"目前不可达 |
| **限流 / 配额** | 04 §15 | 生产风险（PDF 渲染、导出可被刷） |
| **`/api/me` GET/PATCH** | 04 §2 | API 一致性问题，第三方 / 二期端无法获取个人信息 |
| **`.env.example`** | 12 §4 + 部署 | 新人 onboarding 全靠看 README 与代码反推；`ALIYUN_SMS_*`、`CJK_FONT_PATH`、`DATABASE_URL_DEMO` 都没有模板 |
| **部署文档** | 02 §9 / README | README 只有一行"安装 Noto CJK"。Vercel 部署、自建 + Postgres 部署、迁移流程、备份策略都没有 |
| **错误监控（Sentry 之类）** | 02 §10 | 文档标"远期"，可放 P2 |
| **个人级 PersonLocation 的 CRUD API** | 03 §2.7 | 有 model，UI 仅展示当前 residence；历史居住地条目无入口 |
| **`/api/share/:token` 路由** | 04 §12 | `/share/[token]` 页面直接 SSR；没有给二期端使用的 JSON 通道 |

### 1.4 ➕ 文档没写但已做（亮点）

- **SubtreeAdmin（子树管理员）模型** —— 文档只说 OWNER/ADMIN/MEMBER/GUEST 四级，实际多了一级"按人物子树授权"，对大族协作很实用
- **平台 PlatformRole.SUPERADMIN + `/admin/*`** —— 文档没要求，运营层面很实用
- **手机号验证码登录 + 阿里云 SMS** —— 文档把 SMS 列为远期，已实装
- **demo 库 / 生产库物理隔离** —— 文档没提，工程实践上很有价值
- **`focus + upGen` 直系祖先聚焦模式** —— 文档只承诺 `kin5`，实际做了一个折中版
- **审计日志 `before/after` 完整记录** + 后台查看页 —— 文档说"操作日志可追溯"，实现了完整 diff
- **居住地继承解析器（自动按父系/夫上溯）** —— 文档没明说，自然语义补全
- **xlsx-import 干跑预估**（dry/apply 两阶段）—— 文档只说"导入"，实装更稳
- **打印态 CSS（`print:hidden` / `print:bg-white`）** —— 文档没要求，做了
- **真实数据 UI 截图归档** —— 文档没要求，做了

---

## 2. 工程质量观察

| 维度 | 状态 |
|---|---|
| TODO/FIXME 残留 | **0 条**（`grep -rn "TODO\|FIXME" app/ lib/ components/`） |
| `console.*` 残留 | 仅 4 处：`lib/services/sms.ts:58` dev-fallback、`lib/api/error.ts:54` 错误日志、`lib/services/audit.ts:34` 写失败兜底、`lib/pdf/fonts.ts:46` 字体降级提示。**全部合理**，非废弃日志 |
| `eslint-disable` 残留 | 仅 prisma 自动生成代码（`lib/generated/prisma/**`）。**业务代码 0 条** |
| Prisma 索引 | 主路径都有：`Person(familyId, generation/branchId/name)`、`Marriage(familyId, husbandId/wifeId)`、`ParentChild(familyId, parentId/childId)`、`AuditLog(familyId, createdAt)` |
| **缺索引** | `Person.residenceId` 没单列索引。`/tree-filters/options` 在 10580 人时按 residenceId 聚合是一次全表扫描；`Person.deletedAt` 也没索引（每个 `findMany` 都加了 `deletedAt: null`，pg 默认会 seq scan，这在 10580 人量级还能走，但破万后建议补 partial index） |
| Schema 字段已暴露 | 大部分对应有路由。**未暴露**：`PersonLocation`（无 CRUD）、`Branch`（无 CRUD）、`Family.deletedAt`（无路由）、`Person.paperRecord/succession/biography/noteHint`（在 PATCH body 里有 biography/note，但 paperRecord/succession/noteHint 三个字段**没有写接口**，只能通过 xlsx 导入进入） |
| 测试覆盖 | 6 个单测文件 / 875 行 / 24 用例，集中在纯算法。**E2E 完全没做**——`tests/` 下没 `*.e2e.*`，也没 `playwright.config.*`。但 package.json 已经装了 `@playwright/test` |
| 安全性 ① 密码强度 | 注册要求 `min(6).max(128)`——**6 位偏弱**。建议 ≥ 8 + 简单字符种类校验 |
| 安全性 ② Share 链接密码 | 4 位起步——**太短**。可暴破，建议 ≥ 6 |
| 安全性 ③ Token 过期 | ShareLink 过期可设；**JWT session maxAge 30 天**且 cookie 是默认 strategy，未做 token 轮换 |
| 安全性 ④ 限流 | 仅 SMS 有冷却；**写接口、导出、PDF 渲染全裸奔** |
| 安全性 ⑤ 多租户 | 从抽样看，每个 route 都过 `requireFamilyRole(familyId, ...)`，guard 内部按 familyId 过滤；没看到漏 familyId 注入的查询 |
| 安全性 ⑥ 敏感字段 | 公开 share 页只 select 了 `name/alias/gender/...`，未泄露 phone/email/passwordHash。`/api/families/[fid]/members` 把 `phone` 与 `email` 一起返回——属于族内可见，但**分享链接通道目前不存在 API 形态**，未发现外泄 |
| `.env.example` | **不存在**。生产部署 / 新人启动会卡 |
| 部署文档 | 仅 README 提到 Linux Noto CJK 一行；缺：Vercel 配置、自建 Node + pgsql、迁移、备份、回滚 |
| 性能 ① graph route | 10580 人时 `/graph` 一次拉全族 person + marriage + parentChild。Person 字段已 select 精简；建议在 person 数 ≥ 5000 时**按视口分块**或**返回压缩二进制**——目前 JSON 体积估算 1.5–2MB，移动端首屏一次性下载偏重 |
| 性能 ② album/pdf | 同步生成；10580 人 + CJK 字体 + react-pdf 服务端渲染，单次响应可达数十秒。文档自己也说"远期改异步"，目前没异步队列 |
| 性能 ③ family-stats | 在 `/f/[fid]` SSR 路径下每次访问都跑十多个 `groupBy` + 全族 `findMany`，10580 人量级估算 200–500 ms。建议加 5 分钟内存缓存（`unstable_cache` 或 react cache）|
| 性能 ④ tree-filters/options | 拉全族 person 内存聚合 location/generation——10580 行 OK，但属于"每页都新算一遍"，可缓存 |

---

## 3. 未完成清单（按优先级）

### 🟥 P0 — 上线前必须

| # | 项 | 文件 / 模块 | 规模 | 文档章节 | 备注 |
|---|---|---|---|---|---|
| P0-A | **限流中间件**（写接口 60/min、PDF/导出 5/h） | `lib/middleware/ratelimit.ts`（新）+ proxy.ts 接入；可用 `@upstash/ratelimit` + Redis，或 in-memory 单实例兜底 | 中 | 04 §15 | 不做就有被刷垮 PDF 服务的风险 |
| P0-B | **`.env.example` + 部署文档**（Vercel + 自建 Node + 迁移 + 字体） | `.env.example`（新）；README 增章节或 `docs/13-deploy.md` | 小 | 12 §4 / 02 §9 | 阻塞外人复制部署 |
| P0-C | **Family 单条资源 CRUD**（GET/PATCH/DELETE） | `app/api/families/[familyId]/route.ts`（新） | 小-中 | 04 §3 | 改名/软删整族都没出口；DELETE 用 deletedAt |
| P0-D | **密码强度 ≥ 8、ShareLink 密码 ≥ 6** | `app/api/auth/register/route.ts:9`、`app/api/register/route.ts:38`、`share-links/route.ts:39`、`share-links/[id]/route.ts:28` | 小 | 04 §2 隐含 | 一行字符 |
| P0-E | **大族 PDF 异步化**（族 ≥ 1000 时把 PDF 渲染丢任务队列、同步返回 jobId、客户端轮询） | `lib/services/pdf-jobs.ts`（新）、`/album/pdf` 与 `/lineage-chart/pdf` 改造 | 大 | 02 §8 | 不做就被 504、还会拖累整个 Next 实例 |

### 🟧 P1 — 上线时该有

| # | 项 | 文件 / 模块 | 规模 | 文档章节 |
|---|---|---|---|---|
| P1-A | **`mode=kin5` 近亲 5 代过滤**（树谱顶部过滤"近亲"按钮） | `lib/services/tree-layout.ts` 新增 BFS、`/graph` 路由加 `mode` 参数、`TreeView/TreeCanvas` 加切换 UI | 中 | 04 §9 / 01 §3.6 / 02 §6.2 |
| P1-B | **Branches CRUD API + 管理 UI** | `app/api/families/[fid]/branches/route.ts` + `[bid]/route.ts`、admin 增子页 | 中 | 04 §8.1 |
| P1-C | **册谱模板系统**（提供 2-3 套模板：古典竖排 / 现代横排 / 简约） | `lib/services/album.ts` 模板抽象、`/book/templates` `/book/render`、UI 选择器 | 大 | 01 §3.6.4 / 04 §11 |
| P1-D | **`/api/me` GET/PATCH**（昵称、头像、密码改 API 化） | `app/api/me/route.ts`（新）+ `/me` 改用 fetch | 小-中 | 04 §2 |
| P1-E | **xlsx 三 sheet 导入 + Excel 导出对称** | `lib/services/xlsx-import.ts` 拆 sheets、exporters 加 toExcel | 中-大 | 02 §7 / 04 §11 |
| P1-F | **scroll-chart 过滤参数**（branchId / fromGeneration / toGeneration） | `app/api/.../lineage-chart/route.ts` + 前端 UI | 小 | 04 §10 |
| P1-G | **persons 列表 GET（cursor 分页）** | `app/api/.../persons/route.ts` 加 GET | 小 | 04 §6 / 04 §1.5 |
| P1-H | **person 字段 paperRecord/succession/noteHint 写接口** | `persons/[pid]/route.ts` PATCH body 扩字段 | 极小 | 03 §2.3 |
| P1-I | **缺失索引**：`Person(familyId, deletedAt)` partial index、`Person.residenceId` 索引 | `prisma/schema.prisma` + 迁移 | 小 | 03 §4 |
| P1-J | **OWNER 转让家族流程**（Schema 已支持，需事务化 + 二次确认 UI） | `members/[uid]/route.ts` 行为约束 | 小-中 | 02 §5 |

### 🟨 P2 — 后续打磨

| # | 项 | 模块 | 文档章节 |
|---|---|---|---|
| P2-A | family-stats / tree-filters 内存缓存（unstable_cache） | family-stats、tree-filters/options | 02 §8 |
| P2-B | E2E 测试（Playwright）：登录 / 创建家族 / 树视图 / 分享链接 | tests/e2e/* | 12 §1 |
| P2-C | Sentry 接入 | 全局 instrumentation | 02 §10 |
| P2-D | GEDCOM **导入** + 字段映射文档 | exporters + 新 importer | 03 §6 |
| P2-E | PersonLocation 多历史居住地的 CRUD UI | 人物详情 + admin | 03 §2.7 |
| P2-F | hard delete（仅 Owner）+ 软删数据回收脚本 | persons / families | 03 §3.5 |
| P2-G | Person 头像上传 + 对象存储 | `STORAGE_*` env、新接口 | 12 §4 |
| P2-H | 移动端 FAB（快捷新增） | components/layout | 01 §4.1 |
| P2-I | 二期：原生 App / 小程序 | mobile/* | 01 §4.1 / 02 §3 |
| P2-J | 全文搜索 pg_trgm 索引 + 中文分词 | schema + advanced-search | 03 §6 |

---

## 4. 推荐先做的 3 件事（最高 ROI）

> 选取标准：**风险大 × 改动小**、或**用户感知强 × 已有 80% 基础**。

### 1) 限流 + `.env.example` + 部署文档（P0-A + P0-B）

- **为什么先做**：当前 `/album/pdf`、`/lineage-chart/pdf`、`/export`、`/import/xlsx` 都没有任何流控。10580 人量级一次 PDF 渲染十几秒 + 大量内存，**单个恶意客户端连续请求就能让 Next 进程僵死**。这是真正的上线红线。同时 `.env.example` 不存在导致任何复制部署都要回看代码反推 env，部署文档缺失会让自建用户卡在字体、demo 库、SMS 配置上。
- **改动规模**：限流中间件中等（pg-based or upstash），`.env.example` 半小时，部署文档 1-2 小时。
- **回报**：消除上线风险 + 大幅降低 onboarding 摩擦。

### 2) `mode=kin5` 近亲 5 代过滤（P1-A）

- **为什么先做**：`01 §3.6`、`02 §6.2`、`04 §9` 三处文档都把它列为**树谱核心体验**，且关键决策（01 §7-3）专门定义了"近亲 = 5 代"。当前实际只能看父系/母系/全部。10580 人不分块的树视图首屏密度极高，用户找人只能搜索；**有近亲过滤后，"先搜到我，再看我家族"** 才是符合家谱使用场景的导航路径。
- **改动规模**：服务端 BFS（`lib/services/tree-layout.ts` 已有图结构）+ `/graph` 路由参数 + UI tab，半天到一天即可完成。
- **回报**：单一改动直接解决了"图太大、找不到自己"的核心痛点。

### 3) Family 单条资源 + Branch CRUD API（P0-C + P1-B）

- **为什么先做**：当前两个核心实体都没有完整 RESTful 接口。Family 不能改名/软删；Branch 完全没有 API，新建支系只能靠 import 或 SQL。这两个补上后，**整个 API 表面就和 `04-api-design.md` 对得上**，二期端（App、小程序）也才有完整数据通道。
- **改动规模**：两个加起来一天的工作量；纯增量，不动现有代码。
- **回报**：API 表面完整 = 二期端可以零阻力开始；同时 `/f/[fid]/page.tsx` 等 SSR 页面也能逐步从直读 prisma 迁移到统一 API 模式。

---

## 5. 一页摘要

- **架构与数据模型与文档高度一致**，schema 还反向多出几个亮点字段（externalId、paperRecord、succession、biography、subtreeAdmin、verificationCode）。
- **核心功能（树谱/吊线图/详细图/册谱/导入/导出/分享/邀请/审计/字辈表）全部就位**，但**册谱只做一种模板**、**树谱缺近亲 5 代**、**Family/Branch 单条 API 缺失**。
- **代码质量优秀**：业务代码无 TODO、无 console 垃圾日志、无 eslint-disable、24 用例覆盖关键算法。
- **生产化短板集中在三处**：限流、`.env.example` + 部署文档、PDF 异步化。这三件不做不能上线。
- **二期端（移动 App / 小程序）按文档原本就在一期范围外**，可不计入差距。
