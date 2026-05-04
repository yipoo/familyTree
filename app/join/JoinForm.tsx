"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { joinByCode } from "./actions";

export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const res = await joinByCode(code);
      if (res.ok) {
        router.replace(`/f/${res.familyId}`);
        router.refresh();
      } else {
        setErr(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoFocus
        autoComplete="off"
        placeholder="如 K3FH-9P2X"
        className="w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-base tracking-[0.2em] uppercase dark:border-zinc-700 dark:bg-zinc-950"
        maxLength={12}
      />
      {err && (
        <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
      )}
      <button
        type="submit"
        disabled={pending || code.replace(/[\s-]/g, "").length < 8}
        className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "正在加入…" : "加入家族"}
      </button>
    </form>
  );
}
