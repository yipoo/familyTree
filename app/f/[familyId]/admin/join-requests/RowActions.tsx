"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  familyId: string;
  id: string;
  applicantName: string;
}

export function JoinRequestRowActions({ familyId, id, applicantName }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "reject") {
    setError(null);
    let note: string | null = null;
    if (action === "reject") {
      const reason = window.prompt(`拒绝「${applicantName}」的申请，可填备注：`, "");
      if (reason === null) return;
      note = reason.trim() || null;
    } else {
      if (!confirm(`批准「${applicantName}」加入家族？批准后会自动加为成员。`))
        return;
    }
    setBusy(action);
    try {
      const res = await fetch(
        `/api/families/${familyId}/join-requests/${id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, note }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={busy !== null || pending}
          onClick={() => decide("approve")}
          className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {busy === "approve" ? "处理中…" : "批准"}
        </button>
        <button
          type="button"
          disabled={busy !== null || pending}
          onClick={() => decide("reject")}
          className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {busy === "reject" ? "处理中…" : "拒绝"}
        </button>
      </div>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
