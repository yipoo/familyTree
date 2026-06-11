"use client";

/**
 * 创建家族入口：按钮 + 弹层表单。
 * - 任何已登录用户均可创建（API 侧 requireUser 即可）。
 * - 提交成功后自动跳转到该家族首页。
 * - 字段：姓氏 / 家族名（必填），描述、始祖姓名 / 性别（选填）。
 *   足以让新用户独立起步；字辈表、首支系等高级项可在后台慢慢补。
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  /** 按钮文案 */
  label?: string;
  /** 按钮 className（覆盖默认样式） */
  className?: string;
}

type Gender = "MALE" | "FEMALE" | "UNKNOWN";

export function CreateFamilyButton({
  label = "创建家族",
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withFounder, setWithFounder] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);

  // ESC 关闭 / 焦点拦在弹层内最简版本
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  async function handleSubmit(form: FormData) {
    if (pending) return;
    setError(null);
    const surname = String(form.get("surname") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const founderName = String(form.get("founderName") ?? "").trim();
    const founderGender = (String(form.get("founderGender") ?? "MALE") ||
      "MALE") as Gender;
    if (!surname || !name) {
      setError("姓氏与家族名都必填");
      return;
    }
    const body: Record<string, unknown> = {
      surname,
      name,
      description: description || null,
    };
    if (withFounder && founderName) {
      body.founderName = founderName;
      body.founderPerson = { name: founderName, gender: founderGender };
    }
    setPending(true);
    try {
      const res = await fetch("/api/families", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { data: { id: string } };
      // 跳到新家族首页
      router.push(`/f/${j.data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg shadow-sm transition hover:opacity-90"
        }
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-family-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-lg border border-border bg-panel shadow-xl"
          >
            <div className="border-b border-border px-4 py-3">
              <h2
                id="create-family-title"
                className="text-sm font-medium text-foreground"
              >
                创建一个新家族
              </h2>
              <p className="mt-0.5 text-[11px] text-fg-subtle">
                创建后你将自动成为族长，可立即开始添加人物 / 邀请成员。
              </p>
            </div>
            <form action={handleSubmit} className="grid gap-3 p-4 text-xs">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1">
                  <span className="text-fg-muted">姓氏 *</span>
                  <input
                    name="surname"
                    required
                    maxLength={20}
                    placeholder="如：丁"
                    className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-fg-muted">家族名 *</span>
                  <input
                    name="name"
                    required
                    maxLength={80}
                    placeholder="如：丁氏家族 / 湖东丁氏"
                    className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-fg-muted">家族简介（选填）</span>
                <textarea
                  name="description"
                  maxLength={500}
                  rows={2}
                  placeholder="这个家族的来历、堂号、聚居地等，方便族人辨认"
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>

              <fieldset className="rounded border border-border p-3">
                <legend className="px-1 text-fg-muted">始祖（选填）</legend>
                <label className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={withFounder}
                    onChange={(e) => setWithFounder(e.target.checked)}
                  />
                  <span>同时建立一位始祖人物</span>
                </label>
                {withFounder && (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-fg-muted">始祖姓名</span>
                      <input
                        name="founderName"
                        maxLength={40}
                        placeholder="如：丁公太(始祖)"
                        className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-fg-muted">性别</span>
                      <select
                        name="founderGender"
                        defaultValue="MALE"
                        className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                      >
                        <option value="MALE">男</option>
                        <option value="FEMALE">女</option>
                        <option value="UNKNOWN">未知</option>
                      </select>
                    </label>
                    <p className="text-[10px] text-fg-subtle sm:col-span-3">
                      勾选后将自动作为第 1 世登记。日后可以在人物详情里改名 / 改世代 /
                      建支系。
                    </p>
                  </div>
                )}
              </fieldset>

              {error && (
                <p className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </p>
              )}

              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => !pending && setOpen(false)}
                  disabled={pending}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg shadow-sm transition hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "创建中…" : "创建"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
