"use client";

/**
 * 新建家族后的空态引导。
 *
 * 三种起步路径：
 *   1. 从我自己 / 本支起点开始（最常见——大多数用户无法考据上世，从本支已知最早一位起算）
 *   2. 从 1 世始祖开始（系统修谱、有完整谱牒的少数场景）
 *   3. 已有 Excel/CSV → 跳数据导入页
 *
 * 前两个路径都调用 POST /api/families/[familyId]/persons，区别只是默认世代值。
 * 提交成功后跳到该人物详情页继续录入更多信息。
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  familyId: string;
  familyName: string;
  /** 当前用户是否能写（OWNER/ADMIN）。普通成员看到的是"暂无人物"的被动提示。 */
  canManage: boolean;
}

type Mode = "self" | "founder";

export function EmptyFamilyOnboarding({
  familyId,
  familyName,
  canManage,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "UNKNOWN">("MALE");
  const [generation, setGeneration] = useState<number>(1);

  // 切到不同 mode 时重置默认值
  useEffect(() => {
    setError(null);
    if (mode === "founder") {
      setGeneration(1);
    }
  }, [mode]);

  // 访客 / 普通成员：只显示被动文案
  if (!canManage) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-panel p-8 text-center">
        <p className="text-sm text-fg-muted">
          {familyName} 的族谱目前还没有任何人物。
        </p>
        <p className="mt-1 text-xs text-fg-subtle">
          请联系该家族的族长或管理员开始录入。
        </p>
      </div>
    );
  }

  async function submit() {
    if (busy) return;
    if (!name.trim()) {
      setError("姓名必填");
      return;
    }
    if (!Number.isFinite(generation) || generation < 1) {
      setError("起始世代必须 ≥ 1");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/families/${familyId}/persons`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          gender,
          generation,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { data: { id: string } };
      router.push(`/f/${familyId}/p/${j.data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-dashed border-border bg-panel p-6 text-center">
        <h2 className="font-serif text-xl font-semibold text-foreground">
          {familyName} 已经创建好了
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          下一步：把第一个人物添加进来。下面这几种方式选一种开始。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <OptionCard
          title="从我自己 / 本支起点开始"
          recommended
          desc="多数情况下你只知道这一支家族的某位长辈，不必上溯全族。直接把「自己」或「知道的最早一位」录进来作为这支起点，之后再往上往下扩展。"
          actionLabel="新建第一个人物"
          onClick={() => {
            setMode("self");
            setGeneration(1);
            setName("");
          }}
          active={mode === "self"}
        />
        <OptionCard
          title="从 1 世始祖开始"
          desc="如果你掌握完整谱牒或正在系统修谱，可以从公认的 1 世始祖开始录入，再逐代往下展开。"
          actionLabel="建立 1 世始祖"
          onClick={() => {
            setMode("founder");
            setGeneration(1);
            setName("");
          }}
          active={mode === "founder"}
        />
        <Link
          href={`/f/${familyId}/admin/import`}
          className="flex flex-col rounded-lg border border-border bg-panel p-4 text-left transition hover:border-brand/40 hover:bg-muted"
        >
          <h3 className="text-sm font-semibold text-foreground">
            从 Excel / CSV 批量导入
          </h3>
          <p className="mt-1 flex-1 text-xs text-fg-muted">
            如果你已经有整理好的家族电子表格，直接走批量导入，省去逐人录入。
          </p>
          <span className="mt-3 inline-block self-start rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted">
            打开导入页 →
          </span>
        </Link>
      </div>

      {mode && (
        <div className="rounded-lg border border-border bg-panel p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold text-foreground">
            {mode === "self"
              ? "新建本支起点人物"
              : "新建 1 世始祖"}
          </h3>
          <p className="mb-4 text-xs text-fg-muted">
            {mode === "self"
              ? "这位人物会作为你已知最早一位先祖被建立。提交后进入人物详情页继续录入生卒、配偶、子女等。"
              : "这位人物作为家族第 1 世。提交后可在人物详情页继续往下添加 2 世、3 世……"}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              <span className="text-fg-muted">姓名 *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder={mode === "self" ? "如：丁志远" : "如：丁公太(始祖)"}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-fg-muted">性别</span>
              <select
                value={gender}
                onChange={(e) =>
                  setGender(e.target.value as "MALE" | "FEMALE" | "UNKNOWN")
                }
                className="rounded border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="MALE">男</option>
                <option value="FEMALE">女</option>
                <option value="UNKNOWN">未知</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs sm:col-span-3">
              <span className="text-fg-muted">起始世代</span>
              <input
                type="number"
                min={1}
                max={200}
                value={generation}
                onChange={(e) =>
                  setGeneration(Number.parseInt(e.target.value, 10) || 1)
                }
                disabled={mode === "founder"}
                className="w-32 rounded border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-60"
              />
              <span className="text-[11px] text-fg-subtle">
                {mode === "self"
                  ? "无法考证完整字辈时直接保留 1，作为本支自起的世代号；之后可在人物详情里调整。"
                  : "1 世始祖固定为第 1 世。"}
              </span>
            </label>
          </div>
          {error && (
            <p className="mt-3 rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "创建中…" : "创建并进入详情"}
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              disabled={busy}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OptionCard({
  title,
  desc,
  actionLabel,
  onClick,
  active,
  recommended,
}: {
  title: string;
  desc: string;
  actionLabel: string;
  onClick: () => void;
  active: boolean;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col rounded-lg border p-4 text-left transition ${
        active
          ? "border-brand bg-brand-soft text-brand-soft-fg"
          : "border-border bg-panel hover:border-brand/40 hover:bg-muted"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {recommended && (
          <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-medium text-brand-fg">
            推荐
          </span>
        )}
      </div>
      <p className="mt-1 flex-1 text-xs text-fg-muted">{desc}</p>
      <span
        className={`mt-3 inline-block self-start rounded-md px-2.5 py-1 text-xs font-medium ${
          active
            ? "bg-brand text-brand-fg"
            : "border border-border text-foreground"
        }`}
      >
        {actionLabel}
      </span>
    </button>
  );
}
