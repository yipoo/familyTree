"use client";

/**
 * 简化版地点选择器：搜索 + 选中 / 清除。
 *
 * 用于"迁徙记录"等场景：仅从已存在的 Location 中挑（新建走管理员"居住地字典"页）。
 */
import { useEffect, useRef, useState } from "react";

interface Option {
  id: string;
  short: string;
  fullText: string;
}

export function LocationCombo({
  familyId,
  value,
  onChange,
  label,
}: {
  familyId: string;
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Option | null>(null);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // 外部 value 变化（如清空）→ 同步显示
  useEffect(() => {
    if (!value) {
      setSelected(null);
      setQ("");
      return;
    }
    if (selected?.id === value) return;
    fetch(`/api/families/${familyId}/locations/search?q=`)
      .then(async (r) => (r.ok ? ((await r.json()).data as Option[]) : []))
      .then((list) => {
        const o = list.find((x) => x.id === value);
        if (o) {
          setSelected(o);
          setQ(o.short || o.fullText);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, familyId]);

  useEffect(() => {
    const ctrl = new AbortController();
    if (!open) return;
    fetch(`/api/families/${familyId}/locations/search?q=${encodeURIComponent(q)}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setOpts(j.data ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [familyId, q, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(o: Option) {
    setSelected(o);
    setQ(o.short || o.fullText);
    onChange(o.id);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || opts.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % opts.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + opts.length) % opts.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(opts[active]);
          }
        }}
        placeholder={label === "to" ? "目的地…" : "起点…"}
        className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {selected && (
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setQ("");
            onChange(null);
          }}
          className="absolute right-1 top-1.5 text-xs text-zinc-400 hover:text-zinc-700"
          aria-label="清除"
        >
          ×
        </button>
      )}
      {open && opts.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-zinc-300 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-900">
          {opts.map((o, i) => (
            <li
              key={o.id}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-2 py-1 ${
                i === active ? "bg-blue-100 dark:bg-blue-900/40" : ""
              }`}
            >
              <div className="text-sm">{o.short || o.fullText}</div>
              <div className="text-[10px] text-zinc-500">{o.fullText}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
