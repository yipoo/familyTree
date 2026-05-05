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

  // 外部 value 变化时把内部 selected / q 同步——用 React 官方
  // "track previous prop in render + 条件 setState" 派生模式，避免在 useEffect 中同步 setState。
  // 参考：https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    if (!value) {
      // 外部清空 → 内部状态一并清掉
      setSelected(null);
      setQ("");
    } else if (selected?.id !== value) {
      // 外部传入新的 id 但缓存里还没对应 Option ——清掉旧 selected，下方 effect 异步去加载
      setSelected(null);
    }
  }

  // value 已设置但 selected 还未对上：去后端取一次（异步 setState，不违反规则）
  const selectedId = selected?.id ?? null;
  useEffect(() => {
    if (!value) return;
    if (selectedId === value) return;
    let cancelled = false;
    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await fetch(
          `/api/families/${familyId}/locations/search?q=`,
          { signal: ctrl.signal },
        );
        if (cancelled || !r.ok) return;
        const list = (((await r.json()).data ?? []) as Option[]).filter(Boolean);
        if (cancelled) return;
        const o = list.find((x) => x.id === value);
        if (o) {
          setSelected(o);
          setQ(o.short || o.fullText);
        }
      } catch {
        // ignore（包含 AbortError / 网络错误）
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [value, familyId, selectedId]);

  // 下拉搜索：q / open / familyId 变化时拉候选项；setState 全部在 await 之后
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await fetch(
          `/api/families/${familyId}/locations/search?q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal },
        );
        if (cancelled || !r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        setOpts((j.data ?? []) as Option[]);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [familyId, q, open]);

  // 关闭面板：点击外部
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
    // 同步 lastValue，避免 onChange 触发外部 value 变化后又被 render 派生重置
    setLastValue(o.id);
    onChange(o.id);
    setOpen(false);
  }

  function clear() {
    setSelected(null);
    setQ("");
    setLastValue(null);
    onChange(null);
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          if (!e.target.value) {
            setLastValue(null);
            onChange(null);
          }
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
          onClick={clear}
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
