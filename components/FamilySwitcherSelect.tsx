"use client";

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
      className="cursor-pointer rounded border-0 bg-transparent px-1 py-0.5 text-sm font-medium hover:bg-zinc-100 focus:outline-none dark:hover:bg-zinc-800"
    >
      {memberships.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}（{m.surname}）
        </option>
      ))}
    </select>
  );
}
