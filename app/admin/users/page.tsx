import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { UserRow } from "./UserRow";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  const meId = session?.user?.id ?? "";

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      phone: true,
      email: true,
      name: true,
      platformRole: true,
      createdAt: true,
      _count: { select: { members: true, subtreeAdmins: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">用户管理</h1>
        <span className="text-xs text-zinc-500">共 {users.length} 名用户</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900/60">
            <tr>
              <th className="px-3 py-2 font-medium">昵称</th>
              <th className="px-3 py-2 font-medium">手机号</th>
              <th className="px-3 py-2 font-medium">平台角色</th>
              <th className="px-3 py-2 font-medium">家族成员</th>
              <th className="px-3 py-2 font-medium">子树授权</th>
              <th className="px-3 py-2 font-medium">注册时间</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((u) => (
              <UserRow key={u.id} user={u} isSelf={u.id === meId} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
