"use client";

import { useActionState } from "react";

import { createInvite } from "./actions";

type State = { ok?: true; error?: string };

export function CreateInviteForm({ familyId }: { familyId: string }) {
  const action = createInvite.bind(null, familyId);
  const [state, formAction, pending] = useActionState<State | undefined, FormData>(
    action,
    undefined,
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col">
        <span className="mb-1 text-xs text-zinc-500">角色</span>
        <select
          name="role"
          defaultValue="MEMBER"
          className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="MEMBER">成员</option>
          <option value="ADMIN">管理员</option>
          <option value="GUEST">访客（只读）</option>
        </select>
      </label>
      <label className="flex flex-col">
        <span className="mb-1 text-xs text-zinc-500">使用次数</span>
        <select
          name="uses"
          defaultValue="many"
          className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="1">单次</option>
          <option value="10">最多 10 人</option>
          <option value="many">不限</option>
        </select>
      </label>
      <label className="flex flex-col">
        <span className="mb-1 text-xs text-zinc-500">有效期</span>
        <select
          name="ttl"
          defaultValue="30d"
          className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="1d">1 天</option>
          <option value="7d">7 天</option>
          <option value="30d">30 天</option>
          <option value="180d">180 天</option>
          <option value="never">永不过期</option>
        </select>
      </label>
      <label className="flex flex-col">
        <span className="mb-1 text-xs text-zinc-500">备注（可选）</span>
        <input
          name="note"
          maxLength={80}
          placeholder="给濉溪老家叔伯辈"
          className="w-56 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "生成中…" : "生成邀请码"}
      </button>
      {state?.error && (
        <span className="text-xs text-red-600 dark:text-red-400">{state.error}</span>
      )}
      {state?.ok && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">已生成</span>
      )}
    </form>
  );
}
