"use client";

/**
 * 人物 / 家族影像相册：展示 + 上传 + 删除 + 改图注。
 *
 * 自取数据（GET /media?personId=）。上传走 multipart POST。
 * canWrite 决定是否显示上传 / 删除；ossReady=false 时提示未配置。
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface MediaItem {
  id: string;
  kind: "PHOTO" | "DOCUMENT" | "AUDIO" | "VIDEO";
  url: string;
  name?: string | null;
  caption?: string | null;
  mime?: string | null;
}

export function MediaGallery({
  familyId,
  personId,
  canWrite,
  ossReady,
}: {
  familyId: string;
  personId?: string;
  canWrite: boolean;
  ossReady: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarSet, setAvatarSet] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const listUrl = `/api/families/${familyId}/media${personId ? `?personId=${personId}` : ""}`;

  useEffect(() => {
    let alive = true;
    fetch(listUrl)
      .then((r) => r.json())
      .then((j) => {
        if (alive) setItems(j.data ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [listUrl]);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        if (personId) fd.set("personId", personId);
        const r = await fetch(`/api/families/${familyId}/media`, { method: "POST", body: fd });
        const j = await r.json().catch(() => null);
        if (!r.ok) {
          setError(j?.error?.message ?? `「${file.name}」上传失败`);
          break;
        }
        setItems((prev) => [j.data, ...prev]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!confirm("确定删除这个影像吗？此操作不可恢复。")) return;
    const r = await fetch(`/api/families/${familyId}/media/${id}`, { method: "DELETE" });
    if (r.ok) setItems((prev) => prev.filter((m) => m.id !== id));
    else setError("删除失败");
  }

  async function setAsAvatar(item: MediaItem) {
    if (!personId) return;
    const r = await fetch(`/api/families/${familyId}/persons/${personId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: item.url }),
    });
    if (r.ok) {
      setAvatarSet(item.id);
      setTimeout(() => setAvatarSet((c) => (c === item.id ? null : c)), 1500);
      router.refresh();
    } else {
      setError("设置头像失败");
    }
  }

  async function editCaption(item: MediaItem) {
    const next = prompt("图注 / 说明：", item.caption ?? "");
    if (next === null) return;
    const r = await fetch(`/api/families/${familyId}/media/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: next.trim() || null }),
    });
    if (r.ok) {
      setItems((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, caption: next.trim() || null } : m)),
      );
    }
  }

  return (
    <section className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">影像相册</h2>
        {canWrite && ossReady ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,audio/*,video/*"
              multiple
              hidden
              onChange={(e) => onFiles(e.target.files)}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? "上传中…" : "上传照片/文档"}
            </button>
          </>
        ) : null}
      </div>

      {canWrite && !ossReady ? (
        <p className="mb-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
          对象存储未配置（OSS_*），暂不能上传影像。
        </p>
      ) : null}
      {error ? <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}

      {loading ? (
        <p className="py-6 text-center text-sm text-fg-muted">加载中…</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-muted">
          暂无影像{canWrite && ossReady ? "，点击上方上传第一张" : ""}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((m) => (
            <li key={m.id} className="group relative overflow-hidden rounded-md border border-border bg-surface">
              <div className="aspect-square w-full">
                {m.kind === "PHOTO" ? (
                  <a href={m.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt={m.caption ?? m.name ?? "照片"} className="h-full w-full object-cover" />
                  </a>
                ) : m.kind === "AUDIO" ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-2">
                    <span className="text-2xl">🎙️</span>
                    <audio controls src={m.url} className="w-full" />
                  </div>
                ) : m.kind === "VIDEO" ? (
                  <video controls src={m.url} className="h-full w-full object-cover" />
                ) : (
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center"
                  >
                    <span className="text-3xl">📄</span>
                    <span className="line-clamp-2 text-[11px] text-fg-muted">{m.name ?? "文档"}</span>
                  </a>
                )}
              </div>
              {m.caption ? (
                <p className="truncate px-1.5 py-1 text-[11px] text-fg-muted" title={m.caption}>
                  {m.caption}
                </p>
              ) : null}
              {canWrite ? (
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  {personId && m.kind === "PHOTO" ? (
                    <button
                      type="button"
                      onClick={() => setAsAvatar(m)}
                      title="设为头像"
                      className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white hover:bg-brand"
                    >
                      {avatarSet === m.id ? "✓" : "头像"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => editCaption(m)}
                    title="编辑图注"
                    className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white hover:bg-black/80"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    title="删除"
                    className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white hover:bg-red-600"
                  >
                    ✕
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
