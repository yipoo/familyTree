<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 项目约定（Agent 必读）

### 写 API 路由的硬性要求

每个写操作（POST / PATCH / PUT / DELETE）必须满足：

1. **Zod 校验**：用 `z.object({...})` 写 schema，调用 `safeParse`；失败用 `lib/api/error.ts:zodError(err)` 返回 400。
2. **角色守卫**：从 `lib/auth/guard.ts` 选合适的：
   - `requireUser()` — 任何已登录用户
   - `requireFamilyRole(familyId, "MEMBER")` — 家族成员（读）
   - `requireFamilyWrite(familyId)` — 族长 / 管理员（族级写）
   - `requireWriteOnPerson(familyId, personId)` — 对该人物有写权限（含子树管理员）
   - `canWriteOnPerson(user, ...)` — 不抛错版，用于条件分支
3. **AuditLog**：调用 `lib/services/audit.ts:writeAudit(...)`，提供 `before` / `after`。
4. **错误统一**：用 `handleApiError(e)` 包住 try/catch，`AuthError` 自动映射 401/403。

模板：

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFamilyWrite } from "@/lib/auth/guard";
import { handleApiError, readJson, zodError } from "@/lib/api/error";
import { writeAudit } from "@/lib/services/audit";

const Schema = z.object({ /* ... */ });

export async function POST(req: Request, ctx: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await ctx.params;
  try {
    const auth = await requireFamilyWrite(familyId);
    const json = await readJson<unknown>(req);
    const parsed = Schema.safeParse(json);
    if (!parsed.success) return zodError(parsed.error);
    // ... 业务 ...
    await writeAudit({ familyId, actorId: auth.user.id, kind: "CREATE", entity: "...", entityId: id, after: row });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
```

### 写页面的硬性要求

- **响应式**：`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` 等 Tailwind 断点。
- **空 / 加载 / 错误三态**：长加载页加 `loading.tsx`；空数据有提示；错误用 `notFound()` 或 `<not-found.tsx>`。
- **打印态**：含 `print:hidden` 隐藏工具栏；`print:bg-white` `print:p-0` 等已在 `app/globals.css` 提供。
- **服务端组件优先**：默认 SSR；交互部分独立 `"use client"` 子组件。

### 关键模块在哪里

- 关系树布局：`lib/services/tree-layout.ts`
- 吊线图布局：`lib/services/lineage-chart.ts`
- 居住地继承：`lib/services/residence.ts`
- 审计日志：`lib/services/audit.ts`
- 共享错误响应：`lib/api/error.ts`
- 字体注册：`lib/pdf/fonts.ts`
- 册谱组装：`lib/services/album.ts`
- 导出器：`lib/services/exporters.ts`（JSON / CSV / GEDCOM）
- 家族统计：`lib/services/family-stats.ts`
- Excel 解析与导入：`lib/services/xlsx-import.ts` + `xlsx-import-runner.ts`

### 测试

新增纯算法 / 转换器要补 vitest 用例（参考 `tests/`）。运行：

```bash
pnpm test
```

不要为简单 CRUD 写单测——重点是算法、解析器、序列化、权限分支。

### 提交风格

- 中文 commit message
- subject 含分类前缀：`feat(P0-3): ...` / `fix: ...` / `test: ...`
- body 用 bullet 列出变更点
