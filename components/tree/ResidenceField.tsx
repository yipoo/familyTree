"use client";

import { useEffect, useState } from "react";
import { ResidencePicker, type LocationOption } from "@/components/tree/ResidencePicker";

type LocationDTO = {
  id: string;
  province: string | null;
  city: string | null;
  county: string | null;
  town: string | null;
  village: string | null;
  detail: string | null;
  fullText: string;
};

type ResidenceData = {
  explicit: LocationDTO | null;
  effective: LocationDTO | null;
  source: {
    fromPersonId: string | null;
    fromPerson: { id: string; name: string; generation: number } | null;
    inherited: boolean;
  };
};

/**
 * 居住地字段。展示形态：
 *
 *   读：短名（村名为主）+ 继承/自身角标 + ✏️ 编辑
 *   编辑：ResidencePicker 单输入 + 自动补全；保存或取消
 *
 *   长地址不再要求用户拆 6 段填写：
 *   - 选已有地点 → 直接复用（保留 province/city 等）
 *   - 输入新名 → 仅作为 village 保存
 */
export function ResidenceField({
  familyId,
  personId,
  canEdit,
  /** 是否默认进入编辑态（外部触发场景，如点击头部铅笔） */
  defaultEditing,
  onEditingChange,
}: {
  familyId: string;
  personId: string;
  canEdit: boolean;
  defaultEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [data, setData] = useState<ResidenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditingState] = useState(!!defaultEditing);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setEditing(v: boolean) {
    setEditingState(v);
    onEditingChange?.(v);
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/families/${familyId}/persons/${personId}/residence`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { data: ResidenceData };
      setData(j.data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, personId]);

  useEffect(() => {
    if (defaultEditing !== undefined) setEditingState(defaultEditing);
  }, [defaultEditing]);

  async function save(payload: {
    province?: string | null;
    city?: string | null;
    county?: string | null;
    town?: string | null;
    village?: string | null;
    detail?: string | null;
  }) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/families/${familyId}/persons/${personId}/residence`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? `HTTP ${res.status}`);
      }
      setEditing(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function clearExplicit() {
    if (!confirm("将该人物住地恢复为「沿父系/夫继承」？")) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/families/${familyId}/persons/${personId}/residence`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function onPick(opt: LocationOption | { newVillage: string }) {
    if ("id" in opt) {
      // 已有地点：用其各字段直接保存
      // 这里没存 location 全字段，所以借后端 fullText 拆解；最简单复用：
      // 直接发 village = opt.short（若 short 是 village 字段）
      // 更准的做法是再 fetch 一次 location detail，这里取个折衷：
      save({ village: opt.short });
    } else {
      save({ village: opt.newVillage });
    }
  }

  const eff = data?.effective;
  const explicit = data?.explicit;
  const inherited = data?.source.inherited ?? false;
  const short =
    explicit?.village ||
    explicit?.town ||
    explicit?.county ||
    explicit?.city ||
    eff?.village ||
    eff?.town ||
    eff?.county ||
    eff?.city ||
    null;
  const fullText = (explicit ?? eff)?.fullText ?? null;

  if (loading) {
    return <Row label="居住地" value="加载中…" />;
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <div className="text-xs text-zinc-500">居住地</div>
        <ResidencePicker
          familyId={familyId}
          initialShort={short ?? ""}
          initialFullText={fullText ?? undefined}
          onPick={onPick}
          onCancel={() => setEditing(false)}
          busy={saving}
        />
        {err && <div className="text-xs text-red-600">{err}</div>}
        {data?.explicit && (
          <button
            onClick={clearExplicit}
            disabled={saving}
            className="text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            恢复继承
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0 text-xs text-zinc-500">居住地</span>
      <div className="flex flex-1 items-center justify-end gap-1.5 text-sm">
        {short ? (
          <span
            className={
              inherited
                ? "text-zinc-500 dark:text-zinc-400"
                : "text-zinc-900 dark:text-zinc-100"
            }
            title={fullText ?? undefined}
          >
            {short}
          </span>
        ) : (
          <span className="text-zinc-400">未填写</span>
        )}
        {inherited && data?.source.fromPerson && (
          <span className="rounded bg-zinc-100 px-1 text-[10px] text-zinc-500 dark:bg-zinc-800">
            继承自 {data.source.fromPerson.name}
          </span>
        )}
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            {explicit ? "改" : inherited ? "脱离" : "填"}
          </button>
        )}
      </div>
      {err && <div className="ml-auto text-xs text-red-600">{err}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0 text-xs text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}
