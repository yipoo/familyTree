"use client";

/**
 * 人物详情页的"管理"侧栏：编辑入口 / 软删除。
 *
 * 编辑表单走简单内联展开；提交调用 PATCH /api/families/.../persons/:id。
 * 删除调用 DELETE 同一路径。
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface Props {
  familyId: string;
  personId: string;
  personName: string;
}

export function PersonDetailActions({ familyId, personId, personName }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI 传记
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function generateBio() {
    setAiError(null);
    setAiLoading(true);
    setAiOpen(true);
    try {
      const r = await fetch(`/api/families/${familyId}/persons/${personId}/biography`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ save: false }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setAiError(j?.error?.message ?? "生成失败");
        return;
      }
      setAiText(j?.data?.biography ?? "");
    } catch {
      setAiError("网络错误，请重试");
    } finally {
      setAiLoading(false);
    }
  }

  function saveBio() {
    setAiError(null);
    setAiSaving(true);
    startTransition(async () => {
      const r = await fetch(`/api/families/${familyId}/persons/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ biography: aiText }),
      });
      setAiSaving(false);
      if (!r.ok) {
        const e = await r.json().catch(() => null);
        setAiError(e?.error?.message ?? "保存失败");
        return;
      }
      setAiOpen(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`确定要删除「${personName}」吗？此操作可在数据库恢复（软删）。`)) {
      return;
    }
    setError(null);
    setDeleting(true);
    startTransition(async () => {
      const r = await fetch(`/api/families/${familyId}/persons/${personId}`, {
        method: "DELETE",
      });
      setDeleting(false);
      if (!r.ok) {
        const e = await r.json().catch(() => null);
        setError(e?.error?.message ?? "删除失败");
        return;
      }
      router.push(`/f/${familyId}`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-border bg-panel p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">管理</h2>
      <div className="flex flex-col gap-2">
        <a
          href={`/f/${familyId}/tree?focus=${personId}`}
          className="rounded bg-brand px-3 py-1.5 text-center text-xs font-medium text-brand-fg transition hover:opacity-90"
        >
          在树中编辑（详细表单）
        </a>
        <a
          href={`/f/${familyId}/wufu?root=${personId}`}
          className="rounded border border-border px-3 py-1.5 text-center text-xs font-medium text-fg-muted transition hover:bg-muted hover:text-foreground"
        >
          查看五服图（以TA为中心）
        </a>

        {/* AI 传记 */}
        <button
          type="button"
          disabled={aiLoading}
          onClick={generateBio}
          className="rounded border border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-50 disabled:opacity-50 dark:border-violet-700/60 dark:text-violet-300 dark:hover:bg-violet-950/60"
        >
          {aiLoading ? "AI 生成中…" : "✨ AI 生成传记"}
        </button>
        {aiOpen ? (
          <div className="rounded-md border border-border bg-muted/40 p-2">
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              rows={8}
              placeholder={aiLoading ? "正在生成…" : "生成的小传将显示在此，可编辑后保存"}
              className="w-full resize-y rounded border border-border bg-surface p-2 text-xs leading-relaxed outline-none focus:border-brand"
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="mr-auto text-[10px] text-fg-subtle">{aiText.length} 字</span>
              <button
                type="button"
                disabled={aiLoading}
                onClick={generateBio}
                className="rounded border border-border px-2 py-1 text-[11px] text-fg-muted hover:bg-muted disabled:opacity-50"
              >
                重新生成
              </button>
              <button
                type="button"
                disabled={aiSaving || pending || !aiText.trim()}
                onClick={saveBio}
                className="rounded bg-violet-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {aiSaving ? "保存中…" : "保存到传记"}
              </button>
              <button
                type="button"
                onClick={() => setAiOpen(false)}
                className="rounded px-2 py-1 text-[11px] text-fg-muted hover:bg-muted"
              >
                收起
              </button>
            </div>
            <p className="mt-1 text-[10px] text-fg-subtle">
              AI 仅依据谱内事实生成，请核对后再保存。
            </p>
            {aiError && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{aiError}</p>}
          </div>
        ) : null}

        <button
          type="button"
          disabled={deleting || pending}
          onClick={handleDelete}
          className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-700/60 dark:text-red-300 dark:hover:bg-red-950/60"
        >
          {deleting ? "删除中…" : "删除（软删）"}
        </button>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </section>
  );
}
