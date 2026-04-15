# 前端架构（Next.js）

技术栈以 **`docs/12-tech-stack.md`** 为准：App Router、Server Components 与 Client Component 分层。

## 1. 应用结构（建议）

```
src/
  app/                           # App Router：路由、布局、Route Handlers
    (auth)/                      # 登录注册等
    (dashboard)/[tenantId]/      # 租户内页面：tree、persons、stats …
    api/                         # REST / Server 端点
  features/
    genealogy/                   # 人员、关系、树（多为 client + server 成对）
    statistics/
    collaboration/
    media/
    admin/
  entities/                      # 领域类型、Zod schema（可共享 server/client）
  shared/
    api/                         # fetch 封装、TanStack Query 工厂
    ui/
    auth/
```

- **路由**：按租户动态段：`/[tenantId]/persons`、`/[tenantId]/tree` 等（与 `11-information-architecture.md` 对齐）。
- **代码分割**：家谱大图、统计图表库 `next/dynamic` 或 lazy import；默认不把这些重包打进首屏 RSC。
- **Server 默认**：列表首屏、详情只读块优先 RSC + 数据层直查；树与筛选交互为 Client。

## 2. 状态与数据获取

- **服务端状态**：TanStack Query（缓存、重试、失效策略按 `tenantId` 前缀 key）。
- **客户端 UI 状态**：URL query 同步筛选器（可分享链接）；Zustand/Jotai 用于树布局临时状态。
- **乐观更新**：谨慎用于关系创建；失败回滚并 toast。

## 3. 家谱渲染

### 3.1 策略

- **布局**：分层纵向树（祖先在上）或横向；布局算法与渲染分离（纯函数计算节点坐标）。
- **渲染层**：SVG（易打印）或 Canvas（超大量节点）；可混合：视口内 Canvas，缩略 SVG。
- **虚拟化**：仅渲染视口 ± buffer 的节点与边；缩放平移用 CSS transform + 防抖请求子树。

### 3.2 数据加载

- 首屏：`maxDepth` 限制（如 4 代）；展开节点时请求 deeper chunk（`rootId` 切换为当前节点）。
- **防抖合并**同一节点重复展开请求。

### 3.3 交互

- 搜索命中滚动定位与高亮；两人「最近共同祖先」路径请求独立 API（后端可缓存）。

## 4. 统计页

- 图表库：ECharts 或 Visx（按需）；**所有图表旁提供「数据表」切换**（无障碍与导出一致）。
- 筛选器与 `04-api-design.md` 的 `filter` DSL 对齐；变更时 debounce 请求。

## 5. 国际化

- `react-i18next` 或同类；键名分层 `genealogy.*`, `stats.*`。
- 日期：`Intl.DateTimeFormat`；农历展示若需要可独立组件（历法转换服务或库评估）。

## 6. 性能预算（指导值）

- 首屏 JS：控制主包体积；树与统计拆包。
- LCP：关键路由预加载骨架屏。
- 大列表：虚拟列表；避免在 render 中做 O(n²) 关系遍历（预处理成邻接表）。

## 7. 测试

- 单元：筛选器解析、权限映射纯函数。
- 集成：Playwright 关键流（登录、创建人员、加关系）。
- 视觉回归（可选）：统计图。
