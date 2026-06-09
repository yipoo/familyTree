"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

interface LinkRow {
  id: string;
  token: string;
  personId: string;
  personName: string;
  mode: "PERSON_UPDATE" | "ADD_CHILD";
  note: string | null;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  status: "active" | "revoked" | "expired" | "exhausted";
}

interface Hit {
  id: string;
  name: string;
  alias?: string | null;
  generationChar?: string | null;
  generation: number;
}

const MODE_LABEL: Record<LinkRow["mode"], string> = {
  PERSON_UPDATE: "校正本人信息",
  ADD_CHILD: "补全子女",
};

const STATUS_LABEL: Record<LinkRow["status"], string> = {
  active: "有效",
  revoked: "已停用",
  expired: "已过期",
  exhausted: "已用尽",
};

export function CollectManager({ familyId }: { familyId: string }) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 新建表单
  const [picked, setPicked] = useState<Hit | null>(null);
  const [mode, setMode] = useState<LinkRow["mode"]>("PERSON_UPDATE");
  const [note, setNote] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [maxUses, setMaxUses] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 二维码
  const [qr, setQr] = useState<{ id: string; dataUrl: string; url: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/families/${familyId}/collect-links`)
      .then((r) => r.json())
      .then((j) => setLinks(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [familyId]);

  async function create() {
    if (!picked) {
      setError("请先选择目标人物");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const r = await fetch(`/api/families/${familyId}/collect-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: picked.id,
          mode,
          note: note.trim() || undefined,
          expiresInDays: expiresInDays ? Number(expiresInDays) : null,
          maxUses: maxUses ? Number(maxUses) : null,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setError(j?.error?.message ?? "创建失败");
        return;
      }
      setLinks((prev) => [{ ...j.data, status: "active" }, ...prev]);
      setPicked(null);
      setNote("");
      // 立即展示二维码
      await showQr(j.data.id, j.data.token);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("停用后该二维码 / 链接立即失效，确定吗？")) return;
    const r = await fetch(`/api/families/${familyId}/collect-links/${id}`, { method: "DELETE" });
    if (r.ok) {
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, status: "revoked" } : l)));
      if (qr?.id === id) setQr(null);
    }
  }

  async function showQr(id: string, token: string) {
    const url = `${window.location.origin}/collect/${token}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 240, margin: 1 });
    setQr({ id, dataUrl, url });
  }

  function copy(token: string) {
    const url = `${window.location.origin}/collect/${token}`;
    navigator.clipboard?.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied((c) => (c === token ? null : c)), 1500);
  }

  return (
    <div>
      {/* 新建 */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="mb-3 text-sm font-medium">生成新的采集二维码</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-fg-muted">目标人物 *</label>
            {picked ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
                <span>
                  {picked.name}
                  <span className="ml-1 text-xs text-fg-subtle">
                    {picked.generationChar ?? `${picked.generation}世`}
                  </span>
                </span>
                <button type="button" onClick={() => setPicked(null)} className="text-xs text-fg-muted hover:underline">
                  重选
                </button>
              </div>
            ) : (
              <PersonPicker familyId={familyId} onPick={setPicked} />
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-fg-muted">采集内容</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as LinkRow["mode"])}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="PERSON_UPDATE">校正本人信息</option>
              <option value="ADD_CHILD">补全子女</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-fg-muted">有效天数（留空=长期）</label>
            <input
              inputMode="numeric"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value.replace(/\D/g, ""))}
              placeholder="30"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-fg-muted">最多可提交次数（留空=不限）</label>
            <input
              inputMode="numeric"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ""))}
              placeholder="不限"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-fg-muted">给填写人的说明（选填）</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如：请补全您及子女的生卒年与现居地"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
        </div>
        {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        <button
          type="button"
          disabled={creating}
          onClick={create}
          className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "生成中…" : "生成二维码"}
        </button>
      </div>

      {/* 二维码弹窗（内联展开） */}
      {qr ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-border bg-panel p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.dataUrl} alt="采集二维码" width={240} height={240} />
          <p className="break-all text-center text-xs text-fg-muted">{qr.url}</p>
          <div className="flex gap-2">
            <button onClick={() => copy(qr.url.split("/collect/")[1])} className="rounded border border-border px-3 py-1 text-xs hover:bg-muted">
              复制链接
            </button>
            <a href={qr.dataUrl} download="采集二维码.png" className="rounded border border-border px-3 py-1 text-xs hover:bg-muted">
              下载二维码
            </a>
            <button onClick={() => setQr(null)} className="rounded px-3 py-1 text-xs text-fg-muted hover:bg-muted">
              关闭
            </button>
          </div>
          <p className="text-center text-[11px] text-fg-subtle">
            把二维码发到家族群，或打印贴在祠堂 / 老宅，族人扫码即可填写。
          </p>
        </div>
      ) : null}

      {/* 列表 */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="text-left text-xs text-fg-muted">
            <tr>
              <th className="py-2 pr-4 font-medium">目标</th>
              <th className="py-2 pr-4 font-medium">内容</th>
              <th className="py-2 pr-4 font-medium">已提交</th>
              <th className="py-2 pr-4 font-medium">状态</th>
              <th className="py-2 pr-4 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {loading ? (
              <tr><td colSpan={5} className="py-4 text-center text-xs text-fg-subtle">加载中…</td></tr>
            ) : links.length === 0 ? (
              <tr><td colSpan={5} className="py-4 text-center text-xs text-fg-subtle">暂无采集链接</td></tr>
            ) : (
              links.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 pr-4">{l.personName}</td>
                  <td className="py-2 pr-4 text-xs">{MODE_LABEL[l.mode]}</td>
                  <td className="py-2 pr-4 text-xs">
                    {l.uses}
                    {l.maxUses != null ? ` / ${l.maxUses}` : ""}
                  </td>
                  <td className="py-2 pr-4 text-xs">
                    <span className={l.status === "active" ? "text-emerald-600 dark:text-emerald-400" : "text-fg-subtle"}>
                      {STATUS_LABEL[l.status]}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-2 text-xs">
                      {l.status === "active" ? (
                        <>
                          <button onClick={() => showQr(l.id, l.token)} className="text-brand hover:underline">
                            二维码
                          </button>
                          <button onClick={() => copy(l.token)} className="text-fg-muted hover:underline">
                            {copied === l.token ? "已复制" : "复制链接"}
                          </button>
                          <button onClick={() => revoke(l.id)} className="text-red-600 hover:underline dark:text-red-400">
                            停用
                          </button>
                        </>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PersonPicker({ familyId, onPick }: { familyId: string; onPick: (h: Hit) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const term = q.trim();
    const t = setTimeout(async () => {
      if (!term) {
        if (alive) setHits([]);
        return;
      }
      try {
        const res = await fetch(`/api/families/${familyId}/persons/search?q=${encodeURIComponent(term)}&limit=12`);
        const json = await res.json();
        if (alive) {
          setHits(json.data ?? []);
          setOpen(true);
        }
      } catch {
        /* ignore */
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, familyId]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        placeholder="搜索人物姓名…"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
      />
      {open && hits.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-panel py-1 text-sm shadow-lg">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(h);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-muted"
              >
                <span className="truncate">
                  {h.name}
                  {h.alias ? <span className="text-fg-muted">（{h.alias}）</span> : null}
                </span>
                <span className="shrink-0 text-xs text-fg-subtle">{h.generationChar ?? `${h.generation}世`}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
