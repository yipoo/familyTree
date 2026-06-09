"use client";

import { useState, useTransition } from "react";

import {
  deleteUnusedLocation,
  mergeLocations,
  updateLocation,
} from "./actions";

interface Row {
  id: string;
  province: string | null;
  city: string | null;
  county: string | null;
  town: string | null;
  village: string | null;
  detail: string | null;
  fullText: string;
  refs: {
    residents: number;
    branches: number;
    personLocations: number;
    migrations: number;
  };
}

export function LocationsTable({
  familyId,
  rows,
}: {
  familyId: string;
  rows: Row[];
}) {
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);

  const filtered = filter
    ? rows.filter((r) => r.fullText.toLowerCase().includes(filter.toLowerCase()))
    : rows;

  if (rows.length === 0) {
    return (
      <p className="rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
        本家族尚无地点记录。在人物详情里设置居住地时会自动创建。
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="搜索地点（按 fullText 模糊匹配）"
          className="flex-1 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        {mergeFrom && (
          <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            点击目标地点完成合并 ·{" "}
            <button
              onClick={() => setMergeFrom(null)}
              className="underline"
            >
              取消
            </button>
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr>
              <th className="py-2 pr-4 font-medium">地点</th>
              <th className="py-2 pr-4 font-medium">引用</th>
              <th className="py-2 pr-4 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((r) => (
              <RowEditor
                key={r.id}
                familyId={familyId}
                row={r}
                editing={editingId === r.id}
                onEditStart={() => setEditingId(r.id)}
                onEditEnd={() => setEditingId(null)}
                isMergeSource={mergeFrom === r.id}
                isMergeTarget={!!mergeFrom && mergeFrom !== r.id}
                onMergeStart={() => setMergeFrom(r.id)}
                onMergeFinish={() => setMergeFrom(null)}
                mergeFromId={mergeFrom}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowEditor({
  familyId,
  row,
  editing,
  onEditStart,
  onEditEnd,
  isMergeSource,
  isMergeTarget,
  onMergeStart,
  onMergeFinish,
  mergeFromId,
}: {
  familyId: string;
  row: Row;
  editing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
  isMergeSource: boolean;
  isMergeTarget: boolean;
  onMergeStart: () => void;
  onMergeFinish: () => void;
  mergeFromId: string | null;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const totalRefs =
    row.refs.residents +
    row.refs.branches +
    row.refs.personLocations +
    row.refs.migrations;

  function onSave(formData: FormData) {
    setErr(null);
    start(async () => {
      const r = await updateLocation(familyId, row.id, formData);
      if (r?.error) setErr(r.error);
      else onEditEnd();
    });
  }

  function onDelete() {
    if (!confirm(`删除地点「${row.fullText}」？仅可删除未被引用的地点。`)) return;
    start(async () => {
      const r = await deleteUnusedLocation(familyId, row.id);
      if (r?.error) setErr(r.error);
    });
  }

  function onMergeTarget() {
    if (!mergeFromId) return;
    if (
      !confirm(
        `合并地点：把另一条记录的所有引用迁到「${row.fullText}」，并删除原记录？`,
      )
    ) {
      onMergeFinish();
      return;
    }
    start(async () => {
      const r = await mergeLocations(familyId, mergeFromId, row.id);
      if (r?.error) setErr(r.error);
      onMergeFinish();
    });
  }

  if (editing) {
    return (
      <tr className="bg-blue-50/40 dark:bg-blue-950/20">
        <td colSpan={3} className="py-3 pr-4">
          <form action={onSave} className="grid grid-cols-3 gap-2 text-xs">
            <Input name="province" label="省" defaultValue={row.province} />
            <Input name="city" label="市" defaultValue={row.city} />
            <Input name="county" label="县/区" defaultValue={row.county} />
            <Input name="town" label="镇/乡" defaultValue={row.town} />
            <Input name="village" label="村" defaultValue={row.village} />
            <Input name="detail" label="详细" defaultValue={row.detail} />
            <div className="col-span-3 flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={pending}
                className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                保存
              </button>
              <button
                type="button"
                onClick={onEditEnd}
                className="rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                取消
              </button>
              {err && <span className="text-red-600">{err}</span>}
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className={isMergeSource ? "bg-amber-50/40 dark:bg-amber-950/20" : ""}>
      <td className="py-2 pr-4">
        <div>{row.fullText}</div>
        <div className="mt-0.5 text-[11px] text-zinc-400">
          {[row.province, row.city, row.county, row.town, row.village]
            .filter(Boolean)
            .join(" / ") || "—"}
        </div>
      </td>
      <td className="py-2 pr-4 text-xs text-zinc-500">
        <RefBadges r={row.refs} />
      </td>
      <td className="py-2 pr-4">
        <div className="flex items-center gap-2 text-xs">
          {isMergeTarget ? (
            <button
              onClick={onMergeTarget}
              disabled={pending}
              className="rounded bg-amber-600 px-2 py-0.5 text-white hover:bg-amber-700 disabled:opacity-60"
            >
              合并到此
            </button>
          ) : (
            <>
              <button
                onClick={onEditStart}
                className="text-blue-600 hover:underline"
              >
                改名
              </button>
              <button
                onClick={onMergeStart}
                disabled={pending}
                className="text-amber-700 hover:underline dark:text-amber-400"
              >
                合并到…
              </button>
              <button
                onClick={onDelete}
                disabled={pending || totalRefs > 0}
                title={totalRefs > 0 ? "仍被引用，无法删除" : ""}
                className="text-red-600 hover:underline disabled:opacity-30"
              >
                删除
              </button>
            </>
          )}
        </div>
        {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      </td>
    </tr>
  );
}

function Input({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string | null;
}) {
  return (
    <label className="flex flex-col">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        maxLength={name === "village" ? 40 : name === "detail" ? 80 : 20}
        className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
      />
    </label>
  );
}

function RefBadges({
  r,
}: {
  r: Row["refs"];
}) {
  const items: Array<[string, number]> = [
    ["人物", r.residents],
    ["支系", r.branches],
    ["历史", r.personLocations],
    ["迁徙", r.migrations],
  ];
  const nonzero = items.filter(([, n]) => n > 0);
  if (nonzero.length === 0) return <span className="text-zinc-400">未引用</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {nonzero.map(([k, n]) => (
        <span
          key={k}
          className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800"
        >
          {k} {n}
        </span>
      ))}
    </div>
  );
}
