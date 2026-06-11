/**
 * /f/[familyId]/admin/book —— 册谱编辑（前置内容章节系统）
 *
 * 编辑合编本的封面/凡例/谱序/姓氏源流/族规/跋等前置内容：
 *   - 调整章节顺序、开关某章
 *   - 用 markdown 覆盖系统模板文（留空则继续用默认模板）
 *   - 插入自定义文字章节到任意位置
 *
 * 鉴权由 admin/layout.tsx 的 canManageFamily 统一处理。
 * 章节数据走 /api/families/[familyId]/album-sections（GET/POST/PATCH/DELETE/reorder/reset）。
 */
import { AdminSection } from "../_shared";
import { BookSectionManager } from "./BookSectionManager";
import { ossConfigured } from "@/lib/services/oss";

export const dynamic = "force-dynamic";

export default async function AdminBookPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  return (
    <AdminSection
      title="册谱编辑"
      description="编辑合编本的封面、凡例、谱序、姓氏源流、跋等前置内容；可排序、开关章节，或插入自定义文字章节。章节正文留空时使用系统默认模板文。封面版次 / 族规家训 / 姓氏源流的默认文案在「印刷家谱信息」里维护。"
      actions={
        <a
          href={`/f/${familyId}/album/complete`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg-muted transition hover:bg-muted hover:text-foreground"
        >
          查看册谱效果 →
        </a>
      }
    >
      <BookSectionManager familyId={familyId} ossReady={ossConfigured()} />
    </AdminSection>
  );
}
