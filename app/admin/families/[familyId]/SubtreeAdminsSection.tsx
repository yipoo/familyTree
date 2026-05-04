"use client";
import { useState, useTransition } from "react";
import { grantSubtreeAdmin, revokeSubtreeAdmin } from "./actions";
import { PersonSearch, type SearchResult } from "@/components/PersonSearch";

interface Grant {
  id: string;
  userId: string;
  rootPersonId: string;
  note: string | null;
  grantedAt: Date;
  user: { id: string; name: string; phone: string | null };
  root: { id: string; name: string; generation: number };
  grantedBy: { name: string };
}

export function SubtreeAdminsSection({
  familyId,
  grants,
}: {
  familyId: string;
  grants: Grant[];
}) {
  const [phone, setPhone] = useState("");
  const [root, setRoot] = useState<SearchResult | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function grant() {
    if (!phone.trim() || !root) return;
    startTransition(async () => {
      try {
        await grantSubtreeAdmin(familyId, phone, root.id, note);
        setPhone("");
        setRoot(null);
        setNote("");
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    });
  }
  function revoke(id: string, label: string) {
    if (!confirm(`撤销授权：${label}？`)) return;
    startTransition(async () => {
      try {
        await revokeSubtreeAdmin(familyId, id);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <section>
      <h2 className="mb-1 text-base font-semibold">子树管理员（{grants.length}）</h2>
      <p className="mb-3 text-xs text-zinc-500">
        将"某人 + 其父系所有后代"的写权限授予某用户；该用户即可在该子树内编辑、添加、删除人物。
      </p>

      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">用户手机号</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="13800138000"
            className="w-44 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <div className="flex w-72 flex-col gap-1">
          <span className="text-xs text-zinc-500">子树 root 人物</span>
          {root ? (
            <div className="flex items-center justify-between rounded-md bg-blue-50 px-2 py-1.5 text-sm dark:bg-blue-950">
              <span>
                {root.name}（{root.generation} 世）
              </span>
              <button
                onClick={() => setRoot(null)}
                className="text-xs text-blue-600 hover:underline"
              >
                重选
              </button>
            </div>
          ) : (
            <PersonSearch
              familyId={familyId}
              gender="MALE"
              placeholder="搜索（仅男性可作为父系子树根）"
              onPick={setRoot}
            />
          )}
        </div>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-zinc-500">备注（可选）</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="如：负责南支编辑"
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          onClick={grant}
          disabled={pending || !phone.trim() || !root}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          授权
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900/60">
            <tr>
              <th className="px-3 py-2 font-medium">用户</th>
              <th className="px-3 py-2 font-medium">手机号</th>
              <th className="px-3 py-2 font-medium">Root 人物</th>
              <th className="px-3 py-2 font-medium">备注</th>
              <th className="px-3 py-2 font-medium">授权人</th>
              <th className="px-3 py-2 font-medium">时间</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {grants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-xs text-zinc-400">
                  暂无授权
                </td>
              </tr>
            ) : (
              grants.map((g) => (
                <tr key={g.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-3 py-2 font-medium">{g.user.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{g.user.phone ?? "—"}</td>
                  <td className="px-3 py-2">
                    {g.root.name}（{g.root.generation} 世）
                  </td>
                  <td className="px-3 py-2 text-xs">{g.note ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{g.grantedBy.name}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {new Date(g.grantedAt).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() =>
                        revoke(g.id, `${g.user.name} → ${g.root.name}`)
                      }
                      disabled={pending}
                      className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
                    >
                      撤销
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
