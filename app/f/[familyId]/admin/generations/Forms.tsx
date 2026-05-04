"use client";

import { useActionState, useState, useTransition } from "react";

import {
  deleteGeneration,
  updateGenerationChar,
  upsertGeneration,
} from "./actions";

type State = { ok?: true; error?: string };

export function AddGenerationForm({
  familyId,
  suggestNext,
}: {
  familyId: string;
  suggestNext: number;
}) {
  const action = upsertGeneration.bind(null, familyId);
  const [state, formAction, pending] = useActionState<State | undefined, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col">
        <span className="mb-1 text-xs text-zinc-500">世代</span>
        <input
          name="generation"
          type="number"
          min={1}
          max={200}
          defaultValue={suggestNext}
          required
          className="w-20 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="flex flex-col">
        <span className="mb-1 text-xs text-zinc-500">字辈</span>
        <input
          name="character"
          type="text"
          maxLength={4}
          required
          placeholder="如 训"
          className="w-20 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-center text-base font-semibold dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "保存中…" : "新增 / 更新"}
      </button>
      {state?.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
      {state?.ok && (
        <span className="text-xs text-emerald-600">已保存</span>
      )}
    </form>
  );
}

interface Row {
  generation: number;
  character: string;
  personCount: number;
}

export function GenerationsTable({
  familyId,
  rows,
}: {
  familyId: string;
  rows: Row[];
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
        尚未录入字辈。在上方表单添加。
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-zinc-500">
          <tr>
            <th className="py-2 pr-4 font-medium">世代</th>
            <th className="py-2 pr-4 font-medium">字辈</th>
            <th className="py-2 pr-4 font-medium">该代人数</th>
            <th className="py-2 pr-4 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((r) => (
            <RowEditor key={r.generation} familyId={familyId} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowEditor({ familyId, row }: { familyId: string; row: Row }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(row.character);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setErr(null);
    start(async () => {
      const r = await updateGenerationChar(familyId, row.generation, val);
      if (r?.error) setErr(r.error);
      else setEditing(false);
    });
  }

  function del() {
    if (!confirm(`删除第 ${row.generation} 世「${row.character}」字辈？`)) return;
    if (
      row.personCount > 0 &&
      !confirm(
        `第 ${row.generation} 世仍有 ${row.personCount} 个人物。确认仅删除字辈记录？`,
      )
    ) {
      return;
    }
    start(async () => {
      const r = await deleteGeneration(familyId, row.generation);
      if (r?.error) alert(r.error);
    });
  }

  return (
    <tr>
      <td className="py-2 pr-4 font-mono text-zinc-600 dark:text-zinc-400">
        {row.generation} 世
      </td>
      <td className="py-2 pr-4">
        {editing ? (
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            maxLength={4}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setVal(row.character);
                setEditing(false);
              }
            }}
            className="w-16 rounded border border-blue-400 bg-white px-2 py-1 text-center text-base font-semibold dark:bg-zinc-950"
          />
        ) : (
          <span className="text-base font-semibold">{row.character}</span>
        )}
        {err && <span className="ml-2 text-xs text-red-600">{err}</span>}
      </td>
      <td className="py-2 pr-4 text-xs text-zinc-500">
        {row.personCount > 0 ? `${row.personCount} 人` : "—"}
      </td>
      <td className="py-2 pr-4">
        <div className="flex gap-2 text-xs">
          {editing ? (
            <>
              <button
                onClick={save}
                disabled={pending || val === row.character}
                className="rounded bg-blue-600 px-2 py-0.5 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setVal(row.character);
                  setEditing(false);
                  setErr(null);
                }}
                className="rounded border border-zinc-300 px-2 py-0.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                取消
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-blue-600 hover:underline"
              >
                改字
              </button>
              <button
                onClick={del}
                disabled={pending}
                className="text-red-600 hover:underline disabled:opacity-50"
              >
                删除
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
