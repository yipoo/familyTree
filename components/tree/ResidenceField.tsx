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
 * 用 discriminated union 统一管理"加载中 / 已加载 / 出错"——避免独立的
 * loading / data / error 三个 state，再避免 effect 中同步 setLoading(true)。
 */
type FetchState =
  | { kind: "loading" }
  | { kind: "loaded"; data: ResidenceData }
  | { kind: "error"; message: string };

const LOADING: FetchState = { kind: "loading" };

/**
 * 居住地字段。
 *
 *   读：短名（村名为主）+ 继承/自身角标 + ✏️ 编辑
 *   编辑：ResidencePicker 单输入 + 自动补全；保存或取消
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
  // [familyId, personId] 变化时通过 reloadKey 触发 effect 重拉。
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<FetchState>(LOADING);

  // 编辑态："track previous prop 在 render 中条件性 setState" 的官方派生模式：
  //   defaultEditing 改变 → 重置内部 editing；
  //   用户点 "改 / 填" → 内部 setEditing(true)。
  const [editing, setEditingState] = useState(!!defaultEditing);
  const [lastDefault, setLastDefault] = useState<boolean | undefined>(defaultEditing);
  if (defaultEditing !== lastDefault) {
    setLastDefault(defaultEditing);
    setEditingState(!!defaultEditing);
  }

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  function setEditing(v: boolean) {
    setEditingState(v);
    onEditingChange?.(v);
  }

  // 数据拉取：effect 仅做异步流程；setState 全部发生在 await 之后
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/families/${familyId}/persons/${personId}/residence`,
          { cache: "no-store", signal: ctrl.signal },
        );
        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as { data: ResidenceData };
        if (cancelled) return;
        setState({ kind: "loaded", data: j.data });
      } catch (e) {
        if (cancelled) return;
        if ((e as Error).name === "AbortError") return;
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [familyId, personId, reloadKey]);

  function reload() {
    // 触发 effect 重跑——loading 视图由 state.kind === "loading" 表现，
    // 通过事件处理器（用户点击保存/清除）调用，setState 在事件处理器内合规。
    setState(LOADING);
    setReloadKey((k) => k + 1);
  }

  async function save(payload: {
    province?: string | null;
    city?: string | null;
    county?: string | null;
    town?: string | null;
    village?: string | null;
    detail?: string | null;
  }) {
    setSaving(true);
    setSaveErr(null);
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
      reload();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function clearExplicit() {
    if (!confirm("将该人物住地恢复为「沿父系/夫继承」？")) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch(
        `/api/families/${familyId}/persons/${personId}/residence`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reload();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function onPick(opt: LocationOption | { newVillage: string }) {
    if ("id" in opt) {
      // 已有地点：用其 short 作为 village 字段提交（保持原行为）
      save({ village: opt.short });
    } else {
      save({ village: opt.newVillage });
    }
  }

  if (state.kind === "loading") {
    return <Row label="居住地" value="加载中…" />;
  }
  if (state.kind === "error") {
    return <Row label="居住地" value={`加载失败：${state.message}`} />;
  }

  const data = state.data;
  const eff = data.effective;
  const explicit = data.explicit;
  const inherited = data.source.inherited;
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
        {saveErr && <div className="text-xs text-red-600">{saveErr}</div>}
        {data.explicit && (
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
        {inherited && data.source.fromPerson && (
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
      {saveErr && <div className="ml-auto text-xs text-red-600">{saveErr}</div>}
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
