"use client";

import { useActionState, useState } from "react";

import { PersonSearch, type SearchResult } from "@/components/PersonSearch";

import { grantSubtree } from "./actions";

type Member = { userId: string; name: string; role: string };
type State = { ok?: true; error?: string };

export function GrantForm({
  familyId,
  members,
}: {
  familyId: string;
  members: Member[];
}) {
  const action = grantSubtree.bind(null, familyId);
  const [state, formAction, pending] = useActionState<State | undefined, FormData>(
    action,
    undefined,
  );
  const [picked, setPicked] = useState<SearchResult | null>(null);

  // 仅给非 OWNER/ADMIN 的人授子树权限有意义（OWNER/ADMIN 已经全员可写）
  // 但保留全部成员，避免误导，UI 上做轻量提示
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col">
        <span className="mb-1 text-xs text-zinc-500">用户</span>
        <select
          name="userId"
          required
          className="w-48 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">— 请选择 —</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
              {m.role === "OWNER" || m.role === "ADMIN"
                ? `（${m.role === "OWNER" ? "族长" : "管理员"}）`
                : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col">
        <span className="mb-1 text-xs text-zinc-500">子树根人物</span>
        <input
          type="hidden"
          name="rootPersonId"
          value={picked?.id ?? ""}
          required
        />
        <div className="flex w-72 items-center gap-2">
          <div className="flex-1">
            <PersonSearch
              familyId={familyId}
              onPick={(p) => setPicked(p)}
              clearOnPick
              placeholder="搜索姓名 / 别名"
              className="w-full"
            />
          </div>
        </div>
        {picked && (
          <span className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            已选：{picked.name}（第 {picked.generation} 世）
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="ml-2 text-zinc-400 hover:text-zinc-600"
            >
              清除
            </button>
          </span>
        )}
      </div>

      <label className="flex flex-col">
        <span className="mb-1 text-xs text-zinc-500">备注（可选）</span>
        <input
          name="note"
          type="text"
          maxLength={80}
          placeholder="如：负责训贤公一支"
          className="w-56 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <button
        type="submit"
        disabled={pending || !picked}
        className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "授权中…" : "授权"}
      </button>

      {state?.error && (
        <span className="text-xs text-red-600 dark:text-red-400">{state.error}</span>
      )}
      {state?.ok && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">已授权</span>
      )}
    </form>
  );
}
