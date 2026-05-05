"use client";

import { useState } from "react";

interface DryResult {
  mode: "dry";
  rowCount: number;
  personsCreated: number;
  personsUpdated: number;
  synthesizedMothers: number;
  issues: string[];
}

interface ApplyResult {
  mode: "apply";
  rowCount: number;
  personsCreated: number;
  personsUpdated: number;
  generationCharsAdded: number;
  parentChildCreated: number;
  marriagesCreated: number;
  synthesizedMothers: number;
  missingParents: number;
  issues: string[];
}

export function ImportXlsxForm({ familyId }: { familyId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [dry, setDry] = useState<DryResult | null>(null);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(mode: "dry" | "apply") {
    if (!file) {
      setError("请先选择文件");
      return;
    }
    setBusy(true);
    setError(null);
    if (mode === "apply") setApplied(null);
    if (mode === "dry") setDry(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("mode", mode);
      const r = await fetch(`/api/families/${familyId}/import/xlsx`, {
        method: "POST",
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error?.message ?? `请求失败 ${r.status}`);
      } else if (mode === "dry") {
        setDry(j.data);
      } else {
        setApplied(j.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setDry(null);
            setApplied(null);
            setError(null);
          }}
          className="text-sm"
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => call("dry")}
          disabled={!file || busy}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          {busy ? "处理中…" : "干跑预估"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirm("确认执行导入？已存在的人物将被更新。")) return;
            call("apply");
          }}
          disabled={!file || busy}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700"
        >
          {busy ? "导入中…" : "执行导入"}
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700/60 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {dry && (
        <ResultPanel
          title="干跑预估"
          rows={[
            ["数据行数", dry.rowCount],
            ["将新建人物", dry.personsCreated],
            ["将更新人物", dry.personsUpdated],
            ["合成嫁入母亲", dry.synthesizedMothers],
          ]}
          issues={dry.issues}
        />
      )}
      {applied && (
        <ResultPanel
          title="✅ 导入完成"
          rows={[
            ["数据行数", applied.rowCount],
            ["新建人物", applied.personsCreated],
            ["更新人物", applied.personsUpdated],
            ["新增字辈", applied.generationCharsAdded],
            ["新增亲子", applied.parentChildCreated],
            ["新增婚配", applied.marriagesCreated],
            ["合成嫁入母亲", applied.synthesizedMothers],
            ["缺失父母引用", applied.missingParents],
          ]}
          issues={applied.issues}
          tone="ok"
        />
      )}
    </div>
  );
}

function ResultPanel({
  title,
  rows,
  issues,
  tone = "info",
}: {
  title: string;
  rows: [string, number][];
  issues: string[];
  tone?: "info" | "ok";
}) {
  return (
    <div
      className={`rounded border p-4 ${
        tone === "ok"
          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700/60 dark:bg-emerald-950"
          : "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/40"
      }`}
    >
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between">
            <dt className="text-xs text-zinc-500">{k}</dt>
            <dd className="font-mono font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {issues.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-amber-700 dark:text-amber-400">
            告警 {issues.length} 条
          </summary>
          <ul className="mt-1 list-disc pl-5 text-zinc-500">
            {issues.slice(0, 30).map((m, i) => (
              <li key={i}>{m}</li>
            ))}
            {issues.length > 30 && <li>…（共 {issues.length} 条，仅显示前 30）</li>}
          </ul>
        </details>
      )}
    </div>
  );
}
