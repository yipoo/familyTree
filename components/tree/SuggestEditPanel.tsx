"use client";

import { useState } from "react";

interface PersonLite {
  id: string;
  name: string;
  alias: string | null;
}

interface Props {
  familyId: string;
  person: PersonLite;
  onCancel: () => void;
  onSubmitted: () => void;
}

export function SuggestEditPanel({ familyId, person, onCancel, onSubmitted }: Props) {
  const [alias, setAlias] = useState(person.alias ?? "");
  const [birthYear, setBirthYear] = useState("");
  const [deathYear, setDeathYear] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [biography, setBiography] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    setOkMsg(null);
    const changes: Record<string, string | number | null> = {};
    if (alias.trim() !== (person.alias ?? "")) changes.alias = alias.trim() || null;
    if (birthYear.trim()) changes.birthYear = Number(birthYear);
    if (deathYear.trim()) changes.deathYear = Number(deathYear);
    if (birthPlace.trim()) changes.birthPlace = birthPlace.trim();
    if (biography.trim()) changes.biography = biography.trim();
    if (note.trim()) changes.note = note.trim();

    if (Object.keys(changes).length === 0) {
      setErr("请至少修改一项");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch(`/api/families/${familyId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person.id, changes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
      }
      setOkMsg("已提交，等待管理员审核");
      setTimeout(onSubmitted, 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
        填写你想修改/补充的内容；提交后由管理员审核。仅填写需要变更的字段即可。
      </div>

      <Field label="别名">
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          className={inputCls}
          placeholder={person.alias ?? "—"}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="出生年">
          <input
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            type="number"
            className={inputCls}
          />
        </Field>
        <Field label="去世年">
          <input
            value={deathYear}
            onChange={(e) => setDeathYear(e.target.value)}
            type="number"
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="出生地">
        <input
          value={birthPlace}
          onChange={(e) => setBirthPlace(e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label="个人传记">
        <textarea
          value={biography}
          onChange={(e) => setBiography(e.target.value)}
          rows={3}
          className={`${inputCls} resize-y`}
        />
      </Field>
      <Field label="备注">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className={`${inputCls} resize-y`}
        />
      </Field>

      {err && <div className="text-xs text-red-600">{err}</div>}
      {okMsg && <div className="text-xs text-emerald-600">{okMsg}</div>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "提交中…" : "提交建议"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          取消
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
