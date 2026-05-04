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
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        管理
      </h2>
      <div className="flex flex-col gap-2">
        <a
          href={`/f/${familyId}/tree?focus=${personId}`}
          className="rounded bg-blue-600 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-blue-700"
        >
          在树中编辑（详细表单）
        </a>
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
