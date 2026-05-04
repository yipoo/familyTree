"use client";
import { useState, useTransition } from "react";
import {
  addMemberByPhone,
  changeMemberRole,
  removeMember,
} from "./actions";
import type { FamilyRole } from "@/lib/generated/prisma/enums";

interface Member {
  id: string;
  userId: string;
  role: FamilyRole;
  joinedAt: Date;
  user: { id: string; name: string; phone: string | null };
}

const ROLE_OPTIONS: FamilyRole[] = ["OWNER", "ADMIN", "MEMBER", "GUEST"];
const ROLE_LABEL: Record<FamilyRole, string> = {
  OWNER: "族长",
  ADMIN: "管理员",
  MEMBER: "成员",
  GUEST: "访客",
};

export function MembersSection({
  familyId,
  members,
}: {
  familyId: string;
  members: Member[];
}) {
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<FamilyRole>("MEMBER");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!phone.trim()) return;
    startTransition(async () => {
      try {
        await addMemberByPhone(familyId, phone, role);
        setPhone("");
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    });
  }
  function change(userId: string, next: FamilyRole) {
    startTransition(async () => {
      try {
        await changeMemberRole(familyId, userId, next);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    });
  }
  function remove(userId: string, name: string) {
    if (!confirm(`移除「${name}」？`)) return;
    startTransition(async () => {
      try {
        await removeMember(familyId, userId);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">家族成员（{members.length}）</h2>

      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">手机号</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="13800138000"
            className="w-44 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">角色</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as FamilyRole)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}（{r}）
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={add}
          disabled={pending || !phone.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          添加 / 更新
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900/60">
            <tr>
              <th className="px-3 py-2 font-medium">用户</th>
              <th className="px-3 py-2 font-medium">手机号</th>
              <th className="px-3 py-2 font-medium">角色</th>
              <th className="px-3 py-2 font-medium">加入时间</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                <td className="px-3 py-2 font-medium">{m.user.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{m.user.phone ?? "—"}</td>
                <td className="px-3 py-2">
                  <select
                    value={m.role}
                    disabled={pending}
                    onChange={(e) => change(m.userId, e.target.value as FamilyRole)}
                    className="rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500">
                  {new Date(m.joinedAt).toLocaleDateString("zh-CN")}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => remove(m.userId, m.user.name)}
                    disabled={pending}
                    className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
                  >
                    移除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
