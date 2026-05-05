"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { readNow } from "../_shared";

interface AuditItem {
  id: string;
  entity: string;
  entityId: string;
  kind: string;
  createdAt: string;
  actorName: string;
  actorPhone: string | null;
  before: unknown;
  after: unknown;
}

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;
const UNDOABLE_ENTITIES = new Set([
  "Person",
  "Marriage",
  "ParentChild",
  "Migration",
  "Branch",
  "Family",
]);
const UNDOABLE_KINDS = new Set(["CREATE", "UPDATE", "DELETE"]);

const KIND_TONE: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  UPDATE: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  DELETE: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  APPROVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECT: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

const KIND_LABEL: Record<string, string> = {
  CREATE: "创建",
  UPDATE: "修改",
  DELETE: "删除",
  APPROVE: "审批通过",
  REJECT: "审批驳回",
};

export function AuditLogTable({
  items,
  familyId,
  canUndo,
}: {
  items: AuditItem[];
  familyId: string;
  canUndo: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 客户端挂载后固定 nowMs，避免 render 期间调用 Date.now（react-hooks/purity）。
  // 用 render 内 "条件 setState 一次性派生" 的官方推荐模式（与 TreeView.tsx 同款），
  // 避免 effect 内同步 setState 触发的 react-hooks/set-state-in-effect。
  const [nowMs, setNowMs] = useState(0);
  const [nowReady, setNowReady] = useState(false);
  if (typeof window !== "undefined" && !nowReady) {
    setNowReady(true);
    setNowMs(readNow());
  }

  async function handleUndo(id: string) {
    if (!confirm("确认撤回此操作？这会把对应数据恢复到此次写入之前。")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(
        `/api/families/${familyId}/audit/${id}/undo`,
        { method: "POST" },
      );
      const j = (await res.json().catch(() => null)) as
        | { data?: { ok: boolean; message: string }; error?: { message?: string } }
        | null;
      if (!res.ok) throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        暂无日志
      </p>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      {error && (
        <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setError(null)}
          >
            关闭
          </button>
        </div>
      )}
      <table className="w-full min-w-[680px] text-sm">
        <thead className="text-left text-xs text-zinc-500">
          <tr>
            <th className="py-2 pl-4 pr-4 font-medium whitespace-nowrap sm:pl-0">时间</th>
            <th className="py-2 pr-4 font-medium whitespace-nowrap">实体</th>
            <th className="py-2 pr-4 font-medium whitespace-nowrap">类型</th>
            <th className="py-2 pr-4 font-medium whitespace-nowrap">操作人</th>
            <th className="py-2 pr-4 font-medium whitespace-nowrap">详情</th>
            {canUndo && <th className="py-2 pr-4 font-medium whitespace-nowrap">撤回</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((a) => {
            const open = openId === a.id;
            return (
              <Fragment key={a.id}>
                <tr>
                  <td className="py-2 pl-4 pr-4 font-mono text-xs text-zinc-500 whitespace-nowrap sm:pl-0">
                    {new Date(a.createdAt).toLocaleString("zh-CN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                      {a.entity}
                    </span>
                    <span className="ml-1 font-mono text-xs text-zinc-400">
                      #{a.entityId.slice(-6)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${KIND_TONE[a.kind] ?? "bg-zinc-100 text-zinc-700"}`}
                    >
                      {KIND_LABEL[a.kind] ?? a.kind}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-xs whitespace-nowrap">
                    {a.actorName}
                    {a.actorPhone && (
                      <span className="ml-1 font-mono text-zinc-400">
                        ({a.actorPhone})
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : a.id)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {open ? "收起" : "展开"}
                    </button>
                  </td>
                  {canUndo && (
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <UndoCell
                        item={a}
                        busy={busyId === a.id}
                        nowMs={nowMs}
                        onUndo={() => handleUndo(a.id)}
                      />
                    </td>
                  )}
                </tr>
                {open && (
                  <tr className="bg-zinc-50/60 dark:bg-zinc-900/40">
                    <td colSpan={canUndo ? 6 : 5} className="px-4 py-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DiffPane title="before" value={a.before} />
                        <DiffPane title="after" value={a.after} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UndoCell({
  item,
  busy,
  nowMs,
  onUndo,
}: {
  item: AuditItem;
  busy: boolean;
  nowMs: number;
  onUndo: () => void;
}) {
  // 仅当满足 entity / kind / 24 小时窗口时启用
  const ageMs = nowMs - new Date(item.createdAt).getTime();
  const inWindow = ageMs <= UNDO_WINDOW_MS;
  const supported =
    UNDOABLE_ENTITIES.has(item.entity) && UNDOABLE_KINDS.has(item.kind);
  if (!supported) {
    return <span className="text-xs text-zinc-400">不支持</span>;
  }
  if (!inWindow) {
    return <span className="text-xs text-zinc-400">超时</span>;
  }
  return (
    <button
      type="button"
      onClick={onUndo}
      disabled={busy}
      className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
    >
      {busy ? "撤回中…" : "撤回"}
    </button>
  );
}

function DiffPane({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-zinc-500">{title}</p>
      <pre className="overflow-x-auto rounded border border-zinc-200 bg-white p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
