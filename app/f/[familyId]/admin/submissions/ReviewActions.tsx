"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ReviewActions({
  familyId,
  id,
}: {
  familyId: string;
  id: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function call(action: "approve" | "reject") {
    setErr(null);
    try {
      const res = await fetch(`/api/families/${familyId}/submissions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: action === "reject" ? note : null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
      }
      start(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  if (showReject) {
    return (
      <div className="space-y-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="拒绝理由（可选，将通知提交者）"
          className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
        />
        <div className="flex gap-2">
          <button
            onClick={() => call("reject")}
            disabled={pending}
            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            确认拒绝
          </button>
          <button
            onClick={() => setShowReject(false)}
            className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700"
          >
            取消
          </button>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button
        onClick={() => call("approve")}
        disabled={pending}
        className="rounded bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        通过并应用
      </button>
      <button
        onClick={() => setShowReject(true)}
        disabled={pending}
        className="rounded border border-red-200 px-3 py-1 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        拒绝
      </button>
      {err && <span className="text-red-600">{err}</span>}
    </div>
  );
}
