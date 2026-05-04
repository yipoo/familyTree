"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export interface SearchResult {
  id: string;
  name: string;
  alias: string | null;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  generation: number;
  generationChar: string | null;
  isMarriedIn: boolean;
  status: string;
  /** 居住地短名（村名优先），用于区分同名 */
  residenceShort?: string | null;
}

interface Props {
  familyId: string;
  /** 选中后的回调；若提供 navigatePath 则不触发 onPick */
  onPick?: (p: SearchResult) => void;
  /** 选中后跳转的路径模板，{id} 占位符替换为人物 id */
  navigateTemplate?: string;
  placeholder?: string;
  gender?: "MALE" | "FEMALE";
  className?: string;
  /** 选中后是否清空输入 */
  clearOnPick?: boolean;
  autoFocus?: boolean;
  /** 设置后启用搜索历史，按此 key 写入 localStorage（如 "tree-search:familyId"） */
  historyKey?: string;
  /** 历史记录最多保留多少条（默认 8） */
  historyLimit?: number;
}

// ------------------------------------------------------------------
// 历史记录：localStorage 视为外部存储，通过 useSyncExternalStore 订阅
// ------------------------------------------------------------------

const HISTORY_EVENT = "personsearch:history-change";
const EMPTY_HISTORY: SearchResult[] = [];

/** 跨组件实例广播变更（同标签页内 storage 事件不触发，自己派一个） */
function broadcastHistoryChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

function readHistoryRaw(key: string | undefined): string | null {
  if (!key || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseHistory(raw: string | null): SearchResult[] {
  if (!raw) return EMPTY_HISTORY;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as SearchResult[];
  } catch {
    // ignore
  }
  return EMPTY_HISTORY;
}

function useHistory(historyKey: string | undefined): SearchResult[] {
  // 缓存最近一次解析结果——useSyncExternalStore 要求 snapshot "内容相同则同对象引用"。
  const snapshotRef = useRef<{ raw: string | null; parsed: SearchResult[] }>({
    raw: null,
    parsed: EMPTY_HISTORY,
  });

  function getSnapshot() {
    const raw = readHistoryRaw(historyKey);
    if (raw === snapshotRef.current.raw) return snapshotRef.current.parsed;
    const parsed = parseHistory(raw);
    snapshotRef.current = { raw, parsed };
    return parsed;
  }

  function subscribe(notify: () => void) {
    if (typeof window === "undefined") return () => {};
    window.addEventListener("storage", notify);
    window.addEventListener(HISTORY_EVENT, notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener(HISTORY_EVENT, notify);
    };
  }

  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_HISTORY);
}

function pushHistoryStorage(key: string, next: SearchResult[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  broadcastHistoryChange();
}

function clearHistoryStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
  broadcastHistoryChange();
}

// ------------------------------------------------------------------
// PersonSearch
// ------------------------------------------------------------------

export function PersonSearch({
  familyId,
  onPick,
  navigateTemplate,
  placeholder = "搜索姓名 / 别名",
  gender,
  className = "",
  clearOnPick = false,
  autoFocus = false,
  historyKey,
  historyLimit = 8,
}: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // 拉取到的最新一组结果。effect 仅在 fetch 完成后（await 之后）才 setState，
  // 避免 react-hooks/set-state-in-effect。
  const [fetchedResults, setFetchedResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // 派生：q 为空时不展示任何结果——派生而非同步
  const trimmed = q.trim();
  const results: SearchResult[] = trimmed.length === 0 ? EMPTY_HISTORY : fetchedResults;

  const history = useHistory(historyKey);
  const ref = useRef<HTMLDivElement>(null);

  function pushHistory(p: SearchResult) {
    if (!historyKey) return;
    const next = [p, ...history.filter((x) => x.id !== p.id)].slice(0, historyLimit);
    pushHistoryStorage(historyKey, next);
  }
  function clearHistory() {
    if (historyKey) clearHistoryStorage(historyKey);
  }

  // Debounce search —— 仅当 trimmed 非空才发请求。
  // setLoading(true) 已经由 onChange 在用户输入时触发，effect 内部不再做同步 setState。
  useEffect(() => {
    if (!trimmed) return;
    const ctrl = new AbortController();
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const sp = new URLSearchParams({ q: trimmed, limit: "20" });
        if (gender) sp.set("gender", gender);
        const res = await fetch(
          `/api/families/${familyId}/persons/search?${sp}`,
          { signal: ctrl.signal },
        );
        if (cancelled) return;
        if (!res.ok) return;
        const json = (await res.json()) as { data: SearchResult[] };
        if (cancelled) return;
        setFetchedResults(json.data);
        setActive(0);
      } catch {
        // ignore abort / network errors（保留旧 results 减少闪烁）
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(t);
    };
  }, [trimmed, familyId, gender]);

  // Close on outside click —— 此 effect 不做任何 setState，仅挂监听
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(p: SearchResult) {
    pushHistory(p);
    if (navigateTemplate) {
      const url = navigateTemplate.replace("{id}", p.id);
      window.location.href = url;
      return;
    }
    onPick?.(p);
    if (clearOnPick) {
      setQ("");
      setFetchedResults(EMPTY_HISTORY);
    }
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = results[active];
      if (p) pick(p);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        type="text"
        value={q}
        onChange={(e) => {
          const next = e.target.value;
          setQ(next);
          setOpen(true);
          // loading 状态由用户输入事件直接驱动——非 effect 内 setState
          setLoading(next.trim().length > 0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
      />

      {/* 搜索结果 */}
      {open && trimmed.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {loading && results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500">搜索中…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500">无匹配</div>
          ) : (
            <ul>
              {results.map((p, i) => (
                <li key={p.id}>
                  <PersonItem
                    p={p}
                    active={active === i}
                    onClick={() => pick(p)}
                    onHover={() => setActive(i)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 历史记录：仅当输入为空、面板打开 且 启用了 historyKey */}
      {open && trimmed.length === 0 && historyKey && history.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-1 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
            <span>最近搜索</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearHistory();
              }}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              清空
            </button>
          </div>
          <ul>
            {history.map((p) => (
              <li key={p.id}>
                <PersonItem p={p} onClick={() => pick(p)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PersonItem({
  p,
  active,
  onClick,
  onHover,
}: {
  p: SearchResult;
  active?: boolean;
  onClick: () => void;
  onHover?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      className={`flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-sm transition ${
        active ? "bg-blue-50 dark:bg-blue-950" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
      }`}
    >
      <span className="flex items-baseline gap-2">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            p.gender === "MALE"
              ? "bg-blue-500"
              : p.gender === "FEMALE"
                ? "bg-pink-500"
                : "bg-zinc-400"
          }`}
        />
        <span className="font-medium">{p.name}</span>
        {p.residenceShort && (
          <span className="text-xs text-zinc-500">（{p.residenceShort}）</span>
        )}
        {p.alias && <span className="text-xs text-zinc-400">别名 {p.alias}</span>}
        {p.isMarriedIn && <span className="text-[10px] text-amber-600">嫁入</span>}
      </span>
      <span className="text-xs text-zinc-500">
        {p.generation} 世
        {p.generationChar && ` · ${p.generationChar}`}
      </span>
    </button>
  );
}
