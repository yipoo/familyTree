"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Hit {
  id: string;
  name: string;
  alias?: string | null;
  generationChar?: string | null;
  generation: number;
}

/** 搜索人物并将其设为五服图中心（己）。 */
export function WufuRootSearch({ familyId }: { familyId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const term = q.trim();
    const t = setTimeout(async () => {
      if (!term) {
        if (alive) setHits([]);
        return;
      }
      if (alive) setLoading(true);
      try {
        const res = await fetch(
          `/api/families/${familyId}/persons/search?q=${encodeURIComponent(term)}&limit=12`,
        );
        const json = await res.json();
        if (alive) {
          setHits(json.data ?? []);
          setOpen(true);
        }
      } catch {
        if (alive) setHits([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, familyId]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(id: string) {
    setOpen(false);
    setQ("");
    router.push(`?root=${id}`, { scroll: false });
  }

  return (
    <div ref={boxRef} className="relative w-56">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        placeholder="搜索人物设为中心…"
        className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
      />
      {open && (hits.length > 0 || loading) ? (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-panel py-1 text-sm shadow-lg">
          {loading && hits.length === 0 ? (
            <li className="px-3 py-1.5 text-fg-muted">搜索中…</li>
          ) : null}
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => pick(h.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-muted"
              >
                <span className="truncate">
                  {h.name}
                  {h.alias ? <span className="text-fg-muted">（{h.alias}）</span> : null}
                </span>
                <span className="shrink-0 text-xs text-fg-subtle">
                  {h.generationChar ?? `${h.generation}世`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
