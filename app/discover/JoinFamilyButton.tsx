"use client";

/**
 * /discover 卡片底部的"申请加入"按钮。
 *
 * 状态由 server 计算后作为 prop 传入：
 *   - "guest"      未登录 → 引导去登录
 *   - "member"     已是成员 → 显示"已加入"
 *   - "pending"    已申请待审 → 禁用 + 提示
 *   - "rejected"   被拒绝 → 允许重新申请
 *   - "available"  可申请 → 弹一行 textarea 留言
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type JoinStatus =
  | "guest"
  | "member"
  | "pending"
  | "rejected"
  | "available";

interface Props {
  familyId: string;
  status: JoinStatus;
  rejectedNote?: string | null;
}

export function JoinFamilyButton({ familyId, status, rejectedNote }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (status === "guest") {
    return (
      <Link
        href={`/login?next=${encodeURIComponent("/discover")}`}
        className="inline-block rounded-md border border-border bg-panel px-2.5 py-1 text-xs text-fg-muted hover:bg-muted hover:text-foreground"
      >
        登录后申请加入
      </Link>
    );
  }

  if (status === "member") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        已加入
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        已申请待审批
      </span>
    );
  }

  // rejected / available 都允许提交（rejected 会复用同一行）
  async function submit() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/families/${familyId}/join-requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: message.trim() || null }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
      }
      setOpen(false);
      setMessage("");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-xs">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-brand-fg hover:opacity-90"
        >
          {status === "rejected" ? "重新申请" : "申请加入"}
        </button>
      ) : (
        <div className="space-y-1.5 rounded-md border border-border bg-background p-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="可向族长简短介绍自己 / 提供身份线索（选填，最多 200 字）"
            className="w-full rounded border border-border bg-panel px-2 py-1 text-xs"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={submit}
              disabled={busy || pending}
              className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-brand-fg hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "提交中…" : "提交申请"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setMessage("");
                setError(null);
              }}
              disabled={busy}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-fg-muted hover:bg-muted disabled:opacity-50"
            >
              取消
            </button>
          </div>
          {error && <p className="text-[10px] text-red-600">{error}</p>}
        </div>
      )}
      {status === "rejected" && rejectedNote && !open && (
        <p className="mt-1 text-[10px] text-rose-600 dark:text-rose-400">
          上次被拒：{rejectedNote}
        </p>
      )}
    </div>
  );
}
