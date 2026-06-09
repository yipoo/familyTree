"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  familyId: string;
  id: string;
  familyName: string;
}

export function CancelJoinRequestButton({ familyId, id, familyName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function cancel() {
    if (!confirm(`撤回向「${familyName}」的入族申请？`)) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/families/${familyId}/join-requests/${id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "cancel" }),
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
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy || pending}
        onClick={cancel}
        className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
      >
        {busy ? "撤回中…" : "撤回申请"}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
