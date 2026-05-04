"use client";

import { useActionState } from "react";

import { updateProfile } from "./actions";

type State = { ok?: true; error?: string };

export function ProfileForm({ initialName }: { initialName: string }) {
  const [state, formAction, pending] = useActionState<State | undefined, FormData>(
    updateProfile,
    undefined,
  );

  return (
    <form action={formAction} className="flex items-end gap-2">
      <label className="flex flex-1 flex-col">
        <span className="mb-1 text-xs text-zinc-500">昵称</span>
        <input
          name="name"
          defaultValue={initialName}
          maxLength={40}
          required
          className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "保存中…" : "保存"}
      </button>
      {state?.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
      {state?.ok && (
        <span className="text-xs text-emerald-600">已更新</span>
      )}
    </form>
  );
}
