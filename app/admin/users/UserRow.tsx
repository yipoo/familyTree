"use client";
import { useTransition } from "react";
import { setPlatformRole, deleteUser } from "./actions";

interface User {
  id: string;
  phone: string | null;
  email: string | null;
  name: string;
  platformRole: "SUPERADMIN" | "USER";
  createdAt: Date;
  _count: { members: number; subtreeAdmins: number };
}

export function UserRow({ user, isSelf }: { user: User; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();

  function toggleSuper() {
    const next = user.platformRole === "SUPERADMIN" ? "USER" : "SUPERADMIN";
    startTransition(async () => {
      try {
        await setPlatformRole(user.id, next);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    });
  }
  function handleDelete() {
    if (!confirm(`确认删除用户「${user.name}」？\n相关 FamilyMember / SubtreeAdmin 也会一并删除。`))
      return;
    startTransition(async () => {
      try {
        await deleteUser(user.id);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
      <td className="px-3 py-2">
        <span className="font-medium">{user.name}</span>
        {isSelf && <span className="ml-1.5 text-[10px] text-blue-600">（你）</span>}
      </td>
      <td className="px-3 py-2 font-mono text-xs">{user.phone ?? user.email ?? "—"}</td>
      <td className="px-3 py-2">
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            user.platformRole === "SUPERADMIN"
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          {user.platformRole}
        </span>
      </td>
      <td className="px-3 py-2 tabular-nums">{user._count.members}</td>
      <td className="px-3 py-2 tabular-nums">{user._count.subtreeAdmins}</td>
      <td className="px-3 py-2 text-xs text-zinc-500">
        {new Date(user.createdAt).toLocaleDateString("zh-CN")}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1.5">
          <button
            onClick={toggleSuper}
            disabled={pending}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {user.platformRole === "SUPERADMIN" ? "降级" : "升为超管"}
          </button>
          {!isSelf && (
            <button
              onClick={handleDelete}
              disabled={pending}
              className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
            >
              删除
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
