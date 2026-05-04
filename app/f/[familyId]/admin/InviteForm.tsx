"use client";

import { useActionState } from "react";

import { inviteMember } from "./actions";

type State = { ok?: true; error?: string };

export function InviteForm({ familyId }: { familyId: string }) {
  const action = inviteMember.bind(null, familyId);
  const [state, formAction, pending] = useActionState<State | undefined, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col">
        <span className="mb-1 text-xs text-zinc-500">手机号</span>
        <input
          name="phone"
          type="tel"
          required
          pattern="1[3-9]\d{9}"
          placeholder="13800138000"
          className="w-44 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
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
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "邀请中…" : "邀请加入"}
      </button>
      {state?.error && (
        <span className="text-xs text-red-600 dark:text-red-400">{state.error}</span>
      )}
      {state?.ok && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          已添加 / 更新
        </span>
      )}
    </form>
  );
}
