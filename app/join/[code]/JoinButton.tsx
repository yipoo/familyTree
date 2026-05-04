"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";

import { joinByCode } from "../actions";

export function JoinButton({
  code,
  familyId,
}: {
  code: string;
  familyId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onClick() {
    setErr(null);
    start(async () => {
      const res = await joinByCode(code);
      if (res.ok) {
        router.replace(`/f/${familyId}`);
        router.refresh();
      } else {
        setErr(res.error ?? "加入失败");
      }
    });
  }

  return (
    <>
      <button
        onClick={onClick}
        disabled={pending}
        className="block w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "正在加入…" : "确认加入"}
      </button>
      {err && (
        <p className="mt-2 text-center text-xs text-red-600 dark:text-red-400">
          {err}
        </p>
      )}
    </>
  );
}
