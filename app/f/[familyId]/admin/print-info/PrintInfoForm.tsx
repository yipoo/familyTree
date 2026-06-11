"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Initial {
  editionInfo: string | null;
  surnameOrigin: string | null;
  familyRules: string | null;
}

interface Props {
  familyId: string;
  initial: Initial;
}

export function PrintInfoForm({ familyId, initial }: Props) {
  const router = useRouter();
  const [editionInfo, setEditionInfo] = useState(initial.editionInfo ?? "");
  const [surnameOrigin, setSurnameOrigin] = useState(initial.surnameOrigin ?? "");
  const [familyRules, setFamilyRules] = useState(initial.familyRules ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  async function save() {
    if (busy) return;
    setError(null);
    setOk(false);
    setBusy(true);
    try {
      const res = await fetch(`/api/families/${familyId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          editionInfo: editionInfo.trim() || null,
          surnameOrigin: surnameOrigin.trim() || null,
          familyRules: familyRules.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
      }
      setOk(true);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 text-sm">
      <Field
        label="修谱版次"
        hint="封面落款的修谱次序，如「初修」「续修」「三续」「民国版重修」。可为空。"
      >
        <input
          type="text"
          value={editionInfo}
          onChange={(e) => setEditionInfo(e.target.value)}
          maxLength={40}
          placeholder="如：三续 / 民国版重修"
          className="w-full rounded border border-border bg-background px-2.5 py-1.5"
        />
      </Field>

      <Field
        label="姓氏源流"
        hint="合编本《姓氏源流》一节正文。留空时系统会用「X 氏，源远流长……」的自动模板。如填则覆盖。"
      >
        <textarea
          value={surnameOrigin}
          onChange={(e) => setSurnameOrigin(e.target.value)}
          maxLength={5000}
          rows={6}
          placeholder="如：丁氏出自姜姓，齐太公之后……（可分段）"
          className="w-full rounded border border-border bg-background px-2.5 py-1.5 leading-7"
        />
      </Field>

      <Field
        label="族规家训"
        hint="合编本《族规家训》一节正文。多段文字按行换行书写，系统按段分页。无内容则不渲染该章。"
      >
        <textarea
          value={familyRules}
          onChange={(e) => setFamilyRules(e.target.value)}
          maxLength={20000}
          rows={12}
          placeholder={`如：\n一、孝悌为本，敦睦九族。\n二、勤俭兴家，诗书继世。\n三、敬祖宗、睦乡邻、戒奢侈、勿赌博。\n……`}
          className="w-full rounded border border-border bg-background px-2.5 py-1.5 leading-7"
        />
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || pending}
          className="rounded-md bg-brand px-4 py-1.5 text-xs font-medium text-brand-fg shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "保存中…" : "保存"}
        </button>
        {ok && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            已保存 ✓
          </span>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <p className="mb-1.5 text-[11px] text-fg-subtle">{hint}</p>
      {children}
    </label>
  );
}
