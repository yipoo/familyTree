"use client";

/**
 * 旧的 select 形式家族切换器。新的体验请用 `@/components/layout/FamilySwitcher`。
 *
 * 保留这个文件是为了：admin / 旧链接 / 测试不爆栈。
 */

import { useRouter } from "next/navigation";

export function FamilySwitcherSelect({
  currentId,
  memberships,
}: {
  currentId: string;
  memberships: { id: string; name: string; surname: string }[];
}) {
  const router = useRouter();
  return (
    <select
      defaultValue={currentId}
      onChange={(e) => {
        const id = e.target.value;
        if (id && id !== currentId) router.push(`/f/${id}`);
      }}
      className="cursor-pointer rounded border-0 bg-transparent px-1 py-0.5 text-sm font-medium hover:bg-muted focus:outline-none"
    >
      {memberships.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}（{m.surname}）
        </option>
      ))}
    </select>
  );
}
