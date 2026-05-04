import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatInviteCode, validateInvite } from "@/lib/services/invites";

import { JoinButton } from "./JoinButton";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await auth();

  const result = await validateInvite(code);

  if (!result.ok) {
    return <Invalid reason={result.reason} code={code} />;
  }

  const { invite } = result;

  // 已是成员？提示直接进入
  let alreadyMember = false;
  if (session?.user?.id) {
    const m = await prisma.familyMember.findUnique({
      where: {
        userId_familyId: { userId: session.user.id, familyId: invite.familyId },
      },
      select: { role: true },
    });
    alreadyMember = !!m;
  }

  const memberCount = await prisma.familyMember.count({
    where: { familyId: invite.familyId },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs uppercase tracking-wider text-zinc-400">家族邀请</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {invite.family.name}
        </h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          {invite.family.surname} 姓 · {memberCount} 名已加入成员
        </p>
        {invite.family.description && (
          <p className="mt-3 rounded bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
            {invite.family.description}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-[80px_1fr] gap-y-2 text-sm">
          <dt className="text-zinc-500">邀请码</dt>
          <dd className="font-mono tracking-wider">
            {formatInviteCode(invite.code)}
          </dd>
          <dt className="text-zinc-500">角色</dt>
          <dd>{roleZh(invite.role)}</dd>
          <dt className="text-zinc-500">由谁邀请</dt>
          <dd>{invite.createdByName}</dd>
          {invite.remainingUses !== null && (
            <>
              <dt className="text-zinc-500">剩余次数</dt>
              <dd>{invite.remainingUses}</dd>
            </>
          )}
        </dl>

        <div className="mt-6">
          {!session?.user?.id ? (
            <Link
              href={`/login?next=${encodeURIComponent(`/join/${code}`)}`}
              className="block w-full rounded bg-blue-600 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
            >
              先登录再加入
            </Link>
          ) : alreadyMember ? (
            <Link
              href={`/f/${invite.familyId}`}
              className="block w-full rounded bg-zinc-900 py-2 text-center text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              你已是成员，进入家族 →
            </Link>
          ) : (
            <JoinButton code={code} familyId={invite.familyId} />
          )}
        </div>

        <p className="mt-4 text-center text-xs text-zinc-400">
          加入后将在你的「我的家族」列表中看到
        </p>
      </div>
    </div>
  );
}

function Invalid({ reason, code }: { reason: string; code: string }) {
  const msg =
    reason === "expired"
      ? "该邀请链接已过期"
      : reason === "exhausted"
        ? "该邀请名额已用完"
        : reason === "revoked"
          ? "该邀请已被管理员撤销"
          : "邀请码无效";
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold">{msg}</h1>
        <p className="mt-2 font-mono text-xs text-zinc-400">{code}</p>
        <p className="mt-3 text-sm text-zinc-500">请联系管理员重新生成邀请码。</p>
        <Link
          href="/me"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
        >
          返回个人页 →
        </Link>
      </div>
    </div>
  );
}

function roleZh(r: string) {
  return (
    {
      OWNER: "族长",
      ADMIN: "管理员",
      MEMBER: "成员",
      GUEST: "访客（只读）",
    } as Record<string, string>
  )[r] ?? r;
}
