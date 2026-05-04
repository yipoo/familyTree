"use client";

import { useActionState, useEffect, useRef } from "react";

import { changePassword } from "./actions";

type State = { ok?: true; error?: string };

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<State | undefined, FormData>(
    changePassword,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid max-w-sm gap-3 text-sm"
    >
      <label className="flex flex-col">
        <span className="mb-1 text-xs text-zinc-500">原密码</span>
        <input
          type="password"
          name="old"
          autoComplete="current-password"
          required
          className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="flex flex-col">
        <span className="mb-1 text-xs text-zinc-500">新密码（至少 6 位）</span>
        <input
          type="password"
          name="next"
          autoComplete="new-password"
          required
          minLength={6}
          className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="flex flex-col">
        <span className="mb-1 text-xs text-zinc-500">确认新密码</span>
        <input
          type="password"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={6}
          className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      {state?.error && (
        <div className="rounded bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div className="rounded bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          已修改，下次登录请使用新密码
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "提交中…" : "修改密码"}
        </button>
      </div>
    </form>
  );
}
