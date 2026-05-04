"use client";
import { useEffect, useRef, useState } from "react";

export interface LocationOption {
  id: string;
  short: string;
  village: string | null;
  fullText: string;
}

/**
 * 居住地选择器：单输入框 + 自动补全下拉。
 *
 * - 用户输入"丁"，下拉里出现"丁河套"、"丁庄" 等已存在的地点
 * - 选中下拉项 → 直接保存
 * - 也可输入新名字然后保存（新建一条 Location，village = 输入文本）
 */
export function ResidencePicker({
  familyId,
  initialShort,
  initialFullText,
  onPick,
  onCancel,
  busy,
}: {
  familyId: string;
  initialShort?: string;
  initialFullText?: string;
  onPick: (opt: LocationOption | { newVillage: string }) => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const [q, setQ] = useState(initialShort ?? "");
  const [results, setResults] = useState<LocationOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const sp = new URLSearchParams({ q: q.trim(), limit: "20" });
        const res = await fetch(
          `/api/families/${familyId}/locations/search?${sp}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) return;
        const j = (await res.json()) as { data: LocationOption[] };
        setResults(j.data);
        setActive(0);
      } catch {
        // ignore
      }
    }, 150);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, familyId]);

  // 点击外部关闭下拉
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const trimmed = q.trim();
  const exactMatch = results.find((r) => r.short === trimmed);
  const showAddNew = trimmed.length > 0 && !exactMatch;

  function pick(opt: LocationOption) {
    setOpen(false);
    onPick(opt);
  }
  function pickNew() {
    if (!trimmed) return;
    setOpen(false);
    onPick({ newVillage: trimmed });
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const total = results.length + (showAddNew ? 1 : 0);
      setActive((a) => Math.min(a + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active < results.length) pick(results[active]);
      else if (showAddNew) pickNew();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="输入村名简称（如：丁河套）"
          autoFocus
          disabled={busy}
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            取消
          </button>
        )}
      </div>

      {initialFullText && (
        <div className="mt-0.5 text-[10px] text-zinc-400">
          当前完整：{initialFullText}
        </div>
      )}

      {open && (results.length > 0 || showAddNew) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {results.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => pick(r)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-baseline justify-between gap-2 px-2.5 py-1.5 text-left text-sm transition ${
                active === i
                  ? "bg-blue-50 dark:bg-blue-950"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="font-medium">{r.short}</span>
              <span className="truncate text-xs text-zinc-500">{r.fullText}</span>
            </button>
          ))}
          {showAddNew && (
            <button
              type="button"
              onClick={pickNew}
              onMouseEnter={() => setActive(results.length)}
              className={`flex w-full items-center gap-2 border-t border-zinc-100 px-2.5 py-1.5 text-left text-sm dark:border-zinc-800 ${
                active === results.length
                  ? "bg-blue-50 dark:bg-blue-950"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="text-blue-600">+ 新建</span>
              <span className="font-medium">{trimmed}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
