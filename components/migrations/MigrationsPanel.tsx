"use client";

/**
 * 迁徙记录面板：列出 + 增 + 改 + 删
 *
 * scope=PERSON 用于人物详情；scope=BRANCH 用于支系页。
 *
 * 简化处理：暂不支持地点新建（fromLocationId/toLocationId 由用户输入字符串走 LocationPicker 一类，未来再扩展）
 *   ——这里仅支持："from" / "to" 文本字段。提交时若文本非空则在前端先调用 /locations/search 取（或 /locations 创建）。
 *   为了 MVP 上线标准，此版本支持：
 *     - 列表展示
 *     - 删除 / 修改年份与原因 / 备注
 *     - 添加：仅"年份 + 原因 + 备注"，地点选择走 ResidencePicker（已有）从字典挑
 */
import { useEffect, useState, useTransition } from "react";

import { LocationCombo } from "@/components/migrations/LocationCombo";

interface MigrationItem {
  id: string;
  year: number | null;
  reason: string | null;
  note: string | null;
  fromLocation: { id: string; fullText: string } | null;
  toLocation: { id: string; fullText: string } | null;
}

export function MigrationsPanel({
  familyId,
  scope,
  personId,
  branchId,
  canEdit,
}: {
  familyId: string;
  scope: "PERSON" | "BRANCH";
  personId?: string;
  branchId?: string;
  canEdit: boolean;
}) {
  const [items, setItems] = useState<MigrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reload() {
    setLoading(true);
    const sp = new URLSearchParams();
    if (scope === "PERSON" && personId) sp.set("personId", personId);
    if (scope === "BRANCH" && branchId) sp.set("branchId", branchId);
    sp.set("scope", scope);
    fetch(`/api/families/${familyId}/migrations?${sp}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setItems(j.data ?? []);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, scope, personId, branchId]);

  function handleDelete(id: string) {
    if (!confirm("删除此迁徙记录？")) return;
    startTransition(async () => {
      const r = await fetch(`/api/families/${familyId}/migrations/${id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const e = await r.json().catch(() => null);
        setError(e?.error?.message ?? "删除失败");
        return;
      }
      reload();
    });
  }

  return (
    <div className="space-y-3 text-sm">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-700/60 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-xs text-zinc-500">加载中…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-zinc-500">暂无迁徙记录</p>
      ) : (
        <ol className="space-y-2">
          {items.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-baseline gap-2 rounded border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="font-mono text-xs text-zinc-500">
                {m.year ?? "—"}
              </span>
              <span>
                {m.fromLocation?.fullText ?? "—"} → {m.toLocation?.fullText ?? "—"}
              </span>
              {m.reason && (
                <span className="text-xs text-zinc-500">（{m.reason}）</span>
              )}
              {m.note && (
                <span className="text-xs text-zinc-500">备注：{m.note}</span>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={pending}
                  className="ml-auto rounded border border-red-200 px-1.5 py-0.5 text-xs text-red-700 hover:bg-red-50 dark:border-red-700/60 dark:text-red-300 dark:hover:bg-red-950"
                >
                  删除
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {canEdit && (
        <AddForm
          familyId={familyId}
          scope={scope}
          personId={personId}
          branchId={branchId}
          onCreated={reload}
        />
      )}
    </div>
  );
}

function AddForm({
  familyId,
  scope,
  personId,
  branchId,
  onCreated,
}: {
  familyId: string;
  scope: "PERSON" | "BRANCH";
  personId?: string;
  branchId?: string;
  onCreated: () => void;
}) {
  const [year, setYear] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        scope,
        ...(scope === "PERSON" ? { personId } : { branchId }),
        year: year ? Number(year) : null,
        reason: reason || null,
        note: note || null,
        fromLocationId: fromId,
        toLocationId: toId,
      };
      const r = await fetch(`/api/families/${familyId}/migrations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => null);
        setErr(e?.error?.message ?? "提交失败");
        return;
      }
      setYear("");
      setReason("");
      setNote("");
      setFromId(null);
      setToId(null);
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded border border-dashed border-zinc-300 p-3 dark:border-zinc-700"
    >
      <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        新增迁徙
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <label>
          年份
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="如 1980"
            className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="col-span-2 sm:col-span-3">
          原因
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="如 求学 / 务工 / 战乱"
            className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="col-span-2 sm:col-span-2">
          从
          <LocationCombo
            value={fromId}
            onChange={setFromId}
            familyId={familyId}
            label="from"
          />
        </label>
        <label className="col-span-2 sm:col-span-2">
          到
          <LocationCombo
            value={toId}
            onChange={setToId}
            familyId={familyId}
            label="to"
          />
        </label>
        <label className="col-span-2 sm:col-span-4">
          备注
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>
      {err && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{err}</p>
      )}
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "提交中…" : "添加"}
        </button>
      </div>
    </form>
  );
}
