"use client";

import Link from "next/link";
import { useState } from "react";

interface Result {
  id: string;
  name: string;
  alias: string | null;
  gender: string;
  generation: number;
  generationChar: string | null;
  birthYear: number | null;
  deathYear: number | null;
  birthPlace: string | null;
  status: string;
  isMarriedIn: boolean;
}

interface Props {
  familyId: string;
  branches: { id: string; name: string }[];
  generationChars: { generation: number; character: string }[];
}

export function AdvancedSearchPanel({ familyId, branches, generationChars }: Props) {
  const [q, setQ] = useState("");
  const [gender, setGender] = useState("");
  const [status, setStatus] = useState("");
  const [generationChar, setGenerationChar] = useState("");
  const [minGen, setMinGen] = useState("");
  const [maxGen, setMaxGen] = useState("");
  const [minBirthYear, setMinBirthYear] = useState("");
  const [maxBirthYear, setMaxBirthYear] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [branchId, setBranchId] = useState("");
  const [isMarriedIn, setIsMarriedIn] = useState("");
  const [sort, setSort] = useState("generation");
  const [limit, setLimit] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Result[] | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      const set = (k: string, v: unknown) => {
        if (v != null && v !== "") sp.set(k, String(v));
      };
      set("q", q);
      set("gender", gender);
      set("status", status);
      set("generationChar", generationChar);
      set("minGen", minGen);
      set("maxGen", maxGen);
      set("minBirthYear", minBirthYear);
      set("maxBirthYear", maxBirthYear);
      set("birthPlace", birthPlace);
      set("branchId", branchId);
      set("isMarriedIn", isMarriedIn);
      set("sort", sort);
      set("limit", String(limit));

      const r = await fetch(
        `/api/families/${familyId}/persons/advanced-search?${sp}`,
      );
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error?.message ?? `请求失败 ${r.status}`);
        return;
      }
      setItems(j.data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setQ("");
    setGender("");
    setStatus("");
    setGenerationChar("");
    setMinGen("");
    setMaxGen("");
    setMinBirthYear("");
    setMaxBirthYear("");
    setBirthPlace("");
    setBranchId("");
    setIsMarriedIn("");
    setSort("generation");
    setLimit(50);
    setItems(null);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={submit}
        className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <Field label="关键字（姓名/别名/外部ID）" full>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="性别">
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}>
              <option value="">不限</option>
              <option value="MALE">男</option>
              <option value="FEMALE">女</option>
              <option value="UNKNOWN">未知</option>
            </select>
          </Field>
          <Field label="状态">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="">不限</option>
              <option value="ALIVE">在世</option>
              <option value="DECEASED">已故</option>
              <option value="LOST">失联</option>
              <option value="UNKNOWN">未知</option>
            </select>
          </Field>
          <Field label="嫁入">
            <select value={isMarriedIn} onChange={(e) => setIsMarriedIn(e.target.value)} className={inputCls}>
              <option value="">不限</option>
              <option value="true">仅嫁入</option>
              <option value="false">非嫁入</option>
            </select>
          </Field>
          <Field label="支系">
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
              <option value="">不限</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="字辈">
            <select value={generationChar} onChange={(e) => setGenerationChar(e.target.value)} className={inputCls}>
              <option value="">不限</option>
              {generationChars.map((g) => (
                <option key={g.generation} value={g.character}>
                  {g.character}（{g.generation} 世）
                </option>
              ))}
            </select>
          </Field>
          <Field label="世代区间">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={minGen}
                onChange={(e) => setMinGen(e.target.value)}
                placeholder="最小"
                className={`${inputCls} w-1/2`}
              />
              <span className="text-zinc-400">—</span>
              <input
                type="number"
                value={maxGen}
                onChange={(e) => setMaxGen(e.target.value)}
                placeholder="最大"
                className={`${inputCls} w-1/2`}
              />
            </div>
          </Field>
          <Field label="生年区间">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={minBirthYear}
                onChange={(e) => setMinBirthYear(e.target.value)}
                placeholder="如 1900"
                className={`${inputCls} w-1/2`}
              />
              <span className="text-zinc-400">—</span>
              <input
                type="number"
                value={maxBirthYear}
                onChange={(e) => setMaxBirthYear(e.target.value)}
                placeholder="如 2000"
                className={`${inputCls} w-1/2`}
              />
            </div>
          </Field>
          <Field label="出生地（包含）">
            <input
              type="text"
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="排序">
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={inputCls}>
              <option value="generation">世代 升</option>
              <option value="-generation">世代 降</option>
              <option value="name">姓名 升</option>
              <option value="-name">姓名 降</option>
              <option value="birthYear">生年 升</option>
              <option value="-birthYear">生年 降</option>
            </select>
          </Field>
          <Field label="结果上限">
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={inputCls}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "搜索中…" : "搜索"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            重置
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700/60 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {items != null && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-3 text-sm text-zinc-500">
            共 {items.length} 条结果
          </p>
          {items.length === 0 ? (
            <p className="text-sm text-zinc-500">未匹配到任何人物</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <li
                  key={p.id}
                  className="rounded border border-zinc-200 p-2 dark:border-zinc-800"
                >
                  <Link
                    href={`/f/${familyId}/p/${p.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {p.name}
                  </Link>
                  {p.alias && (
                    <span className="ml-1 text-xs text-zinc-500">（{p.alias}）</span>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1 text-xs text-zinc-500">
                    <span>第 {p.generation} 世</span>
                    {p.generationChar && <span>· {p.generationChar}</span>}
                    <span>· {p.gender === "MALE" ? "男" : p.gender === "FEMALE" ? "女" : "—"}</span>
                    {p.birthYear && <span>· {p.birthYear}</span>}
                    {p.isMarriedIn && (
                      <span className="text-pink-600">嫁入</span>
                    )}
                    {p.status === "DECEASED" && <span>†</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-0.5 text-xs text-zinc-500 ${full ? "sm:col-span-3 md:col-span-4" : ""}`}>
      {label}
      {children}
    </label>
  );
}
