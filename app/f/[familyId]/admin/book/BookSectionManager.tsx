"use client";

import { useEffect, useState } from "react";

import { AlbumSectionKind } from "@/lib/generated/prisma/enums";
import {
  defaultTitleForKind,
  canDeleteKind,
  isSystemKind,
} from "@/lib/services/album-sections";

interface Section {
  id: string | null;
  kind: AlbumSectionKind;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  signature: string | null;
  imageUrl: string | null;
  order: number;
  enabled: boolean;
  appliesTo: string[];
}

/** 可用 markdown 正文覆盖的章节类型。 */
const EDITABLE_KINDS = new Set<string>([
  AlbumSectionKind.FANLI,
  AlbumSectionKind.PREFACE,
  AlbumSectionKind.YUANLIU,
  AlbumSectionKind.RULES,
  AlbumSectionKind.POSTSCRIPT,
  AlbumSectionKind.CUSTOM_TEXT,
]);

/** 留空正文时的回退说明。 */
const FALLBACK_HINT: Record<string, string> = {
  FANLI: "留空 → 使用系统默认凡例（自动列出修谱说明、收录人数等）。",
  PREFACE: "留空 → 使用「族谱简介」作为谱序正文。",
  YUANLIU: "留空 → 使用「印刷家谱信息」里的姓氏源流，或系统默认模板。",
  RULES: "留空 → 使用「印刷家谱信息」里的族规家训；都为空则本章不显示。",
  POSTSCRIPT: "留空 → 使用系统默认跋文。",
  CUSTOM_TEXT: "自定义文字章节，用 markdown 书写。",
};

/** 数据驱动章节的来源说明。 */
const AUTO_NOTE: Record<string, string> = {
  ZIBEI: "内容由「字辈表」数据自动生成。",
  COMPILERS: "内容由族长 / 管理员名单自动生成。",
  TULU: "内容由世系数据自动生成（吊线图 + 欧式详录）。",
  PORTRAITS: "由含头像与传略的族人自动生成。",
};

export function BookSectionManager({
  familyId,
  ossReady,
}: {
  familyId: string;
  ossReady: boolean;
}) {
  // 封面（COVER）单独管理，不进可排序列表
  const [cover, setCover] = useState<Section | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const bumpPreview = () => setPreviewNonce((n) => n + 1);

  const base = `/api/families/${familyId}/album-sections`;

  function ingest(j: { data?: Section[]; initialized?: boolean }) {
    const all: Section[] = j.data ?? [];
    setCover(all.find((s) => s.kind === "COVER") ?? null);
    setSections(all.filter((s) => s.kind !== "COVER"));
    setInitialized(!!j.initialized);
  }

  useEffect(() => {
    fetch(base)
      .then((r) => r.json())
      .then(ingest)
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  async function refresh() {
    ingest(await fetch(base).then((r) => r.json()));
    bumpPreview();
  }

  async function initSections(force = false) {
    if (busy) return;
    if (force && !confirm("恢复默认会丢弃所有章节编辑与自定义章节，确定吗？")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${base}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error?.message ?? "初始化失败");
      ingest({ data: j.data, initialized: true });
      bumpPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "初始化失败");
    } finally {
      setBusy(false);
    }
  }

  function saveCover(patch: Partial<Section>) {
    return run(async () => {
      const r = await fetch(cover?.id ? `${base}/${cover.id}` : base, {
        method: cover?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cover?.id ? patch : { kind: "COVER", ...patch }),
      });
      if (!r.ok) {
        throw new Error(
          (await r.json().catch(() => null))?.error?.message ?? "保存失败",
        );
      }
      await refresh();
    });
  }

  async function toggle(sec: Section) {
    if (!sec.id) return;
    const next = sections.map((s) =>
      s.id === sec.id ? { ...s, enabled: !s.enabled } : s,
    );
    setSections(next);
    const r = await fetch(`${base}/${sec.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !sec.enabled }),
    });
    if (r.ok) bumpPreview();
    else refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= sections.length) return;
    const next = sections.slice();
    [next[index], next[j]] = [next[j], next[index]];
    setSections(next);
    if (next.some((s) => !s.id)) return; // 未初始化不持久化
    const r = await fetch(`${base}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((s, i) => ({ id: s.id, order: i })) }),
    });
    if (r.ok) bumpPreview();
    else refresh();
  }

  async function saveEdit(sec: Section, patch: Partial<Section>) {
    if (!sec.id) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${base}/${sec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error?.message ?? "保存失败");
      setSections((prev) => prev.map((s) => (s.id === sec.id ? { ...s, ...patch } : s)));
      setEditingId(null);
      bumpPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function postSection(payload: Record<string, unknown>) {
    const r = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.error?.message ?? "新增失败");
    await refresh();
    setInitialized(true);
    setEditingId(j.data?.id ?? null);
  }

  /**
   * 上传图片到 OSS，返回 /media 给的（已签名）URL，直接存库。
   * 读取时 ossSignIfOurs 会按 pathname 重新签名（忽略旧 query），故存签名 URL 也安全，
   * 且能让编辑器即时预览（私有读 bucket 也能显示）。
   */
  async function uploadImage(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`/api/families/${familyId}/media`, {
      method: "POST",
      body: fd,
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.error?.message ?? "上传失败");
    return String(j.data.url);
  }

  const addText = () =>
    run(() => postSection({ kind: "CUSTOM_TEXT", title: "新增章节", body: "" }));
  const addPreface = () =>
    run(() => postSection({ kind: "PREFACE", title: "谱序", body: "" }));
  const addImageFile = (file: File) =>
    run(async () => {
      const url = await uploadImage(file);
      await postSection({ kind: "CUSTOM_IMAGE", title: "图片页", imageUrl: url, body: "" });
    });

  async function remove(sec: Section) {
    if (!sec.id) return;
    if (!confirm(`删除「${sec.title || defaultTitleForKind(sec.kind)}」章节？`)) return;
    const r = await fetch(`${base}/${sec.id}`, { method: "DELETE" });
    if (r.ok) {
      setSections((prev) => prev.filter((s) => s.id !== sec.id));
      bumpPreview();
    } else {
      const j = await r.json().catch(() => null);
      setError(j?.error?.message ?? "删除失败");
    }
  }

  if (loading) {
    return <p className="py-6 text-center text-xs text-fg-subtle">加载中…</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-fg-subtle">
          编辑后下方预览会自动刷新（合编本体例）
        </p>
        <button
          type="button"
          onClick={() => setShowPreview((s) => !s)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          {showPreview ? "隐藏预览" : "显示实时预览"}
        </button>
      </div>

      <CoverEditor
        key={cover?.id ?? "new"}
        cover={cover}
        ossReady={ossReady}
        busy={busy}
        onUploadImage={uploadImage}
        onSave={saveCover}
      />

      {!initialized && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            尚未初始化章节
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            目前册谱使用一套系统默认章节（凡例 / 谱序 / 姓氏源流 / 字辈表 / 族规 /
            修谱人员 / 世系图录 / 像赞 / 跋）。点下方按钮把它们落库后，即可排序、开关、
            用 markdown 改写正文，或插入自定义章节。
          </p>
          <button
            type="button"
            onClick={() => initSections(false)}
            disabled={busy}
            className="mt-3 rounded-md bg-brand px-4 py-1.5 text-xs font-medium text-brand-fg hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "初始化中…" : "初始化章节"}
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {sections.map((sec, i) => (
          <SectionRow
            key={sec.id ?? `virtual-${i}`}
            sec={sec}
            index={i}
            total={sections.length}
            editable={initialized}
            isEditing={editingId === sec.id && !!sec.id}
            busy={busy}
            ossReady={ossReady}
            onUploadImage={uploadImage}
            onToggle={() => toggle(sec)}
            onUp={() => move(i, -1)}
            onDown={() => move(i, 1)}
            onEdit={() => setEditingId(sec.id)}
            onCancel={() => setEditingId(null)}
            onSave={(patch) => saveEdit(sec, patch)}
            onDelete={() => remove(sec)}
          />
        ))}
      </ul>

      {initialized && (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
          <span className="text-xs text-fg-subtle">插入：</span>
          <button
            type="button"
            onClick={addText}
            disabled={busy}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            + 文字章节
          </button>
          <button
            type="button"
            onClick={addPreface}
            disabled={busy}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            + 谱序
          </button>
          <label
            className={`rounded-md border border-border px-3 py-1.5 text-xs font-medium ${
              ossReady && !busy
                ? "cursor-pointer text-foreground hover:bg-muted"
                : "cursor-not-allowed text-fg-subtle opacity-50"
            }`}
            title={ossReady ? "" : "图片章节需要先配置对象存储（OSS）"}
          >
            + 图片章节
            <input
              type="file"
              accept="image/*"
              disabled={!ossReady || busy}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addImageFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {!ossReady && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">
              图片需配置 OSS
            </span>
          )}
          <button
            type="button"
            onClick={() => initSections(true)}
            disabled={busy}
            className="ml-auto text-xs text-fg-subtle hover:text-red-600 hover:underline disabled:opacity-50"
          >
            恢复默认
          </button>
        </div>
      )}

      {showPreview && (
        <div className="border-t border-hairline pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              实时预览 · 合编本
            </span>
            <button
              type="button"
              onClick={bumpPreview}
              className="text-xs text-fg-muted hover:text-foreground hover:underline"
            >
              手动刷新
            </button>
          </div>
          <iframe
            key={previewNonce}
            src={`/f/${familyId}/album/complete?_pv=${previewNonce}`}
            title="册谱预览"
            className="h-[70vh] w-full rounded-lg border border-border bg-white"
          />
          <p className="mt-1 text-[11px] text-fg-subtle">
            预览为完整合编本渲染；族谱较大时加载稍慢。打印 / 下载 PDF 请到册谱页操作。
          </p>
        </div>
      )}
    </div>
  );
}

function SectionRow({
  sec,
  index,
  total,
  editable,
  isEditing,
  busy,
  ossReady,
  onUploadImage,
  onToggle,
  onUp,
  onDown,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  sec: Section;
  index: number;
  total: number;
  editable: boolean;
  isEditing: boolean;
  busy: boolean;
  ossReady: boolean;
  onUploadImage: (file: File) => Promise<string>;
  onToggle: () => void;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<Section>) => void;
  onDelete: () => void;
}) {
  const title = sec.title?.trim() || defaultTitleForKind(sec.kind);
  const system = isSystemKind(sec.kind);
  const isImage = sec.kind === "CUSTOM_IMAGE";
  const canEdit = EDITABLE_KINDS.has(sec.kind) || isImage;
  const auto = AUTO_NOTE[sec.kind];

  return (
    <li
      className={`rounded-lg border bg-panel p-3 ${
        sec.enabled ? "border-border" : "border-dashed border-border opacity-60"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* 排序 */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={onUp}
            disabled={!editable || index === 0}
            className="px-1 text-fg-subtle hover:text-foreground disabled:opacity-30"
            aria-label="上移"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onDown}
            disabled={!editable || index === total - 1}
            className="px-1 text-fg-subtle hover:text-foreground disabled:opacity-30"
            aria-label="下移"
          >
            ▼
          </button>
        </div>

        {/* 标题 + 类型 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {title}
            </span>
            <KindBadge kind={sec.kind} system={system} />
            {!sec.enabled && (
              <span className="shrink-0 text-[10px] text-fg-subtle">已隐藏</span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-fg-subtle">
            {auto ??
              (sec.body?.trim()
                ? "已自定义正文"
                : FALLBACK_HINT[sec.kind] ?? "—")}
          </p>
        </div>

        {/* 操作 */}
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <button
            type="button"
            onClick={onToggle}
            disabled={!editable}
            className="text-fg-muted hover:text-foreground disabled:opacity-30"
          >
            {sec.enabled ? "隐藏" : "显示"}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={isEditing ? onCancel : onEdit}
              disabled={!editable}
              className="text-brand hover:underline disabled:opacity-30"
            >
              {isEditing ? "收起" : "编辑"}
            </button>
          )}
          {canDeleteKind(sec.kind) && (
            <button
              type="button"
              onClick={onDelete}
              disabled={!editable}
              className="text-red-600 hover:underline disabled:opacity-30 dark:text-red-400"
            >
              删除
            </button>
          )}
        </div>
      </div>

      {isEditing && canEdit && (
        <SectionEditor
          sec={sec}
          busy={busy}
          ossReady={ossReady}
          onUploadImage={onUploadImage}
          onSave={onSave}
          onCancel={onCancel}
        />
      )}
    </li>
  );
}

function SectionEditor({
  sec,
  busy,
  ossReady,
  onUploadImage,
  onSave,
  onCancel,
}: {
  sec: Section;
  busy: boolean;
  ossReady: boolean;
  onUploadImage: (file: File) => Promise<string>;
  onSave: (patch: Partial<Section>) => void;
  onCancel: () => void;
}) {
  const isImage = sec.kind === "CUSTOM_IMAGE";
  const [title, setTitle] = useState(sec.title ?? "");
  const [body, setBody] = useState(sec.body ?? "");
  const [signature, setSignature] = useState(sec.signature ?? "");
  const [imageUrl, setImageUrl] = useState(sec.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  async function replaceImage(file: File) {
    setUploading(true);
    setUploadErr(null);
    try {
      setImageUrl(await onUploadImage(file));
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-hairline pt-3">
      <label className="block">
        <span className="mb-1 block text-xs text-fg-muted">
          标题（留空用默认「{defaultTitleForKind(sec.kind)}」）
        </span>
        <input
          type="text"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={defaultTitleForKind(sec.kind)}
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
        />
      </label>

      {isImage ? (
        <div className="space-y-2">
          <span className="block text-xs text-fg-muted">图片</span>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="章节图片"
              className="max-h-48 rounded border border-border object-contain"
            />
          ) : (
            <p className="text-xs text-fg-subtle">尚未设置图片</p>
          )}
          <label
            className={`inline-block rounded-md border border-border px-3 py-1.5 text-xs font-medium ${
              ossReady && !uploading
                ? "cursor-pointer text-foreground hover:bg-muted"
                : "cursor-not-allowed text-fg-subtle opacity-50"
            }`}
          >
            {uploading ? "上传中…" : imageUrl ? "替换图片" : "上传图片"}
            <input
              type="file"
              accept="image/*"
              disabled={!ossReady || uploading}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) replaceImage(f);
                e.target.value = "";
              }}
            />
          </label>
          {uploadErr && <p className="text-xs text-red-600">{uploadErr}</p>}
        </div>
      ) : (
        <label className="block">
          <span className="mb-1 block text-xs text-fg-muted">
            正文（Markdown：<code># 标题</code> · <code>**加粗**</code> ·{" "}
            <code>- 列表</code>；空行分段）
          </span>
          <textarea
            value={body}
            maxLength={50000}
            rows={8}
            onChange={(e) => setBody(e.target.value)}
            placeholder={FALLBACK_HINT[sec.kind] ?? ""}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm leading-7"
          />
        </label>
      )}

      {isImage && (
        <label className="block">
          <span className="mb-1 block text-xs text-fg-muted">图注（选填）</span>
          <input
            type="text"
            value={body}
            maxLength={500}
            onChange={(e) => setBody(e.target.value)}
            placeholder="如：摄于一九八〇年祠堂落成"
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
          />
        </label>
      )}

      {!isImage && (
        <label className="block">
          <span className="mb-1 block text-xs text-fg-muted">
            落款（选填，如「族裔 XX 谨序 · 公元二〇二六年」）
          </span>
          <input
            type="text"
            value={signature}
            maxLength={200}
            onChange={(e) => setSignature(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
          />
        </label>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy || uploading}
          onClick={() =>
            onSave({
              title: title.trim() || null,
              body: body.trim() || null,
              signature: signature.trim() || null,
              ...(isImage ? { imageUrl: imageUrl || null } : {}),
            })
          }
          className="rounded-md bg-brand px-4 py-1.5 text-xs font-medium text-brand-fg hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-fg-muted hover:text-foreground"
        >
          取消
        </button>
      </div>
    </div>
  );
}

function KindBadge({ kind, system }: { kind: AlbumSectionKind; system: boolean }) {
  const custom = kind === "CUSTOM_TEXT" || kind === "CUSTOM_IMAGE";
  const cls = custom
    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
    : system
      ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  const label = custom ? "自定义" : system ? "自动生成" : "可编辑";
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function CoverEditor({
  cover,
  ossReady,
  busy,
  onUploadImage,
  onSave,
}: {
  cover: Section | null;
  ossReady: boolean;
  busy: boolean;
  onUploadImage: (file: File) => Promise<string>;
  onSave: (patch: Partial<Section>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(cover?.title ?? "");
  const [subtitle, setSubtitle] = useState(cover?.subtitle ?? "");
  const [signature, setSignature] = useState(cover?.signature ?? "");
  const [imageUrl, setImageUrl] = useState(cover?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  // 注：cover 刷新后通过父级 key 重挂载本组件来同步初值（见 <CoverEditor key=… />），
  // 避免在 effect 里 setState（react-hooks/set-state-in-effect）。

  async function replace(file: File) {
    setUploading(true);
    setUploadErr(null);
    try {
      setImageUrl(await onUploadImage(file));
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-medium text-foreground">
          封面{" "}
          <span className="ml-1 text-[11px] font-normal text-fg-subtle">
            {cover ? "已自定义" : "使用默认（家族名）"}
          </span>
        </span>
        <span className="text-xs text-brand">{open ? "收起" : "编辑"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-fg-muted">主标题（留空用家族名）</span>
            <input
              type="text"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：丁氏宗谱"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-fg-muted">副标题 / 堂号（选填）</span>
            <input
              type="text"
              value={subtitle}
              maxLength={120}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="如：敦睦堂"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </label>
          <div className="space-y-2">
            <span className="block text-xs text-fg-muted">封面图（选填，居中显示于标题上方）</span>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="封面图"
                className="max-h-32 rounded border border-border object-contain"
              />
            )}
            <label
              className={`inline-block rounded-md border border-border px-3 py-1.5 text-xs font-medium ${
                ossReady && !uploading
                  ? "cursor-pointer text-foreground hover:bg-muted"
                  : "cursor-not-allowed text-fg-subtle opacity-50"
              }`}
            >
              {uploading ? "上传中…" : imageUrl ? "替换封面图" : "上传封面图"}
              <input
                type="file"
                accept="image/*"
                disabled={!ossReady || uploading}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) replace(f);
                  e.target.value = "";
                }}
              />
            </label>
            {!ossReady && (
              <span className="ml-2 text-[11px] text-amber-600 dark:text-amber-400">
                需配置 OSS
              </span>
            )}
            {imageUrl && (
              <button
                type="button"
                onClick={() => setImageUrl("")}
                className="ml-2 text-[11px] text-fg-subtle hover:text-red-600 hover:underline"
              >
                移除封面图
              </button>
            )}
            {uploadErr && <p className="text-xs text-red-600">{uploadErr}</p>}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-fg-muted">落款（留空用修谱年月）</span>
            <input
              type="text"
              value={signature}
              maxLength={200}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="如：公元二〇二六年 续修"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </label>
          <p className="text-[11px] text-fg-subtle">
            修谱版次（如「三续」）在「印刷家谱信息」里维护。
          </p>
          <button
            type="button"
            disabled={busy || uploading}
            onClick={() =>
              onSave({
                title: title.trim() || null,
                subtitle: subtitle.trim() || null,
                signature: signature.trim() || null,
                imageUrl: imageUrl || null,
              })
            }
            className="rounded-md bg-brand px-4 py-1.5 text-xs font-medium text-brand-fg hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "保存中…" : "保存封面"}
          </button>
        </div>
      )}
    </div>
  );
}
