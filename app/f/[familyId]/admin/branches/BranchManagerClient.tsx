"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface BranchRow {
  id: string;
  name: string;
  rootPersonId: string;
  rootPersonName: string;
  locationFullText: string | null;
  description: string | null;
  personCount: number;
  migrationCount: number;
}

interface PersonOption {
  id: string;
  name: string;
  generation: number;
}

interface Props {
  familyId: string;
  branches: BranchRow[];
  persons: PersonOption[];
}

export function BranchManagerClient({ familyId, branches, persons }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const hasPersons = persons.length > 0;
  // 空族时强制走"新建独立人物"，避免下拉为空导致无法创建
  const [rootMode, setRootMode] = useState<"existing" | "new">(
    hasPersons ? "existing" : "new",
  );

  async function call(method: string, url: string, body?: unknown) {
    setError(null);
    const res = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleCreate(form: FormData) {
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    if (!name) {
      setError("支系名必填");
      return;
    }
    let body: Record<string, unknown>;
    if (rootMode === "existing") {
      const rootPersonId = String(form.get("rootPersonId") ?? "").trim();
      if (!rootPersonId) {
        setError("请选择根人物");
        return;
      }
      body = { name, rootPersonId, description: description || null };
    } else {
      const rootName = String(form.get("rootName") ?? "").trim();
      const gender = String(form.get("rootGender") ?? "MALE");
      const genStr = String(form.get("rootGeneration") ?? "1");
      const generation = Number.parseInt(genStr, 10);
      if (!rootName) {
        setError("根人物姓名必填");
        return;
      }
      if (!Number.isFinite(generation) || generation < 1) {
        setError("起始世代必须是 ≥ 1 的整数");
        return;
      }
      body = {
        name,
        newRoot: { name: rootName, gender, generation },
        description: description || null,
      };
    }
    try {
      await call("POST", `/api/families/${familyId}/branches`, body);
      setCreateOpen(false);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDelete(b: BranchRow) {
    if (b.personCount > 0 || b.migrationCount > 0) {
      setError("该支系下尚有挂载，无法删除");
      return;
    }
    if (!confirm(`确认删除支系「${b.name}」？`)) return;
    try {
      await call("DELETE", `/api/families/${familyId}/branches/${b.id}`);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleRename(b: BranchRow) {
    const name = window.prompt("支系新名称：", b.name);
    if (!name || name === b.name) return;
    try {
      await call("PATCH", `/api/families/${familyId}/branches/${b.id}`, { name });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg hover:opacity-90"
        >
          {createOpen ? "取消" : "新建支系"}
        </button>
        {pending && <span className="text-xs text-fg-muted">刷新中…</span>}
        {error && (
          <span className="text-xs text-red-600">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-2 underline"
            >
              关闭
            </button>
          </span>
        )}
      </div>

      {createOpen && (
        <form
          className="mb-4 grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2"
          action={handleCreate}
        >
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="text-fg-muted">支系名</span>
            <input
              name="name"
              required
              maxLength={50}
              className="rounded border border-border bg-panel px-2 py-1 text-sm"
            />
          </label>

          {hasPersons ? (
            <fieldset className="flex flex-col gap-1.5 text-xs sm:col-span-2">
              <legend className="text-fg-muted">根人物来源</legend>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="rootMode"
                  value="existing"
                  checked={rootMode === "existing"}
                  onChange={() => setRootMode("existing")}
                  className="mt-0.5"
                />
                <span>
                  <span className="text-foreground">选已有人物作为根</span>
                  <span className="block text-[10px] text-fg-subtle">
                    适合从某位已知祖先派出的支系
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="rootMode"
                  value="new"
                  checked={rootMode === "new"}
                  onChange={() => setRootMode("new")}
                  className="mt-0.5"
                />
                <span>
                  <span className="text-foreground">新建独立人物作为根（无上世）</span>
                  <span className="block text-[10px] text-fg-subtle">
                    适合"找不到上一世"的离散分支始祖
                  </span>
                </span>
              </label>
            </fieldset>
          ) : (
            <p className="text-xs text-fg-subtle sm:col-span-2">
              该家族尚无人物，将作为离散分支始祖建立第一个根人物。
            </p>
          )}

          {rootMode === "existing" ? (
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              <span className="text-fg-muted">根人物</span>
              <select
                name="rootPersonId"
                required
                className="rounded border border-border bg-panel px-2 py-1 text-sm"
              >
                <option value="">— 请选择 —</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（{p.generation} 世）
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-fg-muted">始祖姓名</span>
                <input
                  name="rootName"
                  required
                  maxLength={40}
                  placeholder="如：丁明远"
                  className="rounded border border-border bg-panel px-2 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-fg-muted">性别</span>
                <select
                  name="rootGender"
                  defaultValue="MALE"
                  className="rounded border border-border bg-panel px-2 py-1 text-sm"
                >
                  <option value="MALE">男</option>
                  <option value="FEMALE">女</option>
                  <option value="UNKNOWN">未知</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                <span className="text-fg-muted">起始世代</span>
                <input
                  name="rootGeneration"
                  type="number"
                  min={1}
                  max={200}
                  defaultValue={1}
                  required
                  className="w-32 rounded border border-border bg-panel px-2 py-1 text-sm"
                />
                <span className="text-[10px] text-fg-subtle">
                  无对应字辈时直接填本支自起的世代号；后续可在人物详情里改
                </span>
              </label>
            </>
          )}

          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="text-fg-muted">说明（可选）</span>
            <textarea
              name="description"
              maxLength={500}
              rows={2}
              className="rounded border border-border bg-panel px-2 py-1 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg hover:opacity-90"
            >
              创建
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="text-left text-xs text-fg-muted">
            <tr>
              <th className="py-2 pr-4 font-medium">支系名</th>
              <th className="py-2 pr-4 font-medium">根人物</th>
              <th className="py-2 pr-4 font-medium">居住地</th>
              <th className="py-2 pr-4 font-medium">人物数</th>
              <th className="py-2 pr-4 font-medium">迁徙</th>
              <th className="py-2 pr-4 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {branches.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-xs text-fg-muted">
                  暂无支系。新建一个开始。
                </td>
              </tr>
            )}
            {branches.map((b) => (
              <tr key={b.id}>
                <td className="py-2 pr-4">{b.name}</td>
                <td className="py-2 pr-4 text-xs text-fg-muted">
                  {b.rootPersonName}
                </td>
                <td className="py-2 pr-4 text-xs text-fg-muted">
                  {b.locationFullText ?? "—"}
                </td>
                <td className="py-2 pr-4 tabular-nums">{b.personCount}</td>
                <td className="py-2 pr-4 tabular-nums">{b.migrationCount}</td>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRename(b)}
                      className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                    >
                      改名
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(b)}
                      disabled={b.personCount > 0 || b.migrationCount > 0}
                      className="rounded border border-border px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950/40"
                      title={
                        b.personCount > 0 || b.migrationCount > 0
                          ? "尚有人物 / 迁徙挂载"
                          : "删除支系"
                      }
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
