"use client";

import { useState, useTransition } from "react";

import {
  changeMemberRole,
  removeMember,
  revokeInvite,
  revokeShareLink,
  revokeSubtree,
} from "./actions";
import { formatInviteCode } from "@/lib/services/invite-format";

const ROLE_OPTIONS = [
  { v: "OWNER", l: "族长" },
  { v: "ADMIN", l: "管理员" },
  { v: "MEMBER", l: "成员" },
  { v: "GUEST", l: "访客" },
];

export function ChangeRoleForm({
  familyId,
  userId,
  currentRole,
  canManageOwner,
}: {
  familyId: string;
  userId: string;
  currentRole: string;
  canManageOwner: boolean;
}) {
  const [pending, start] = useTransition();
  const options = canManageOwner
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((o) => o.v !== "OWNER");

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value;
    if (role === currentRole) return;
    if (!confirm(`确认将角色改为「${labelOf(role)}」？`)) {
      e.target.value = currentRole;
      return;
    }
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("role", role);
    start(async () => {
      const res = await changeMemberRole(familyId, fd);
      if (res?.error) alert(res.error);
    });
  }

  return (
    <select
      defaultValue={currentRole}
      disabled={pending}
      onChange={onChange}
      className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
}

export function RemoveMemberForm({
  familyId,
  userId,
  disabled,
}: {
  familyId: string;
  userId: string;
  disabled: boolean;
}) {
  const [pending, start] = useTransition();
  function onClick() {
    if (!confirm("确认移除该成员？同时会撤销其在该家族内的所有子树授权。")) return;
    const fd = new FormData();
    fd.set("userId", userId);
    start(async () => {
      const res = await removeMember(familyId, fd);
      if (res?.error) alert(res.error);
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
    >
      移除
    </button>
  );
}

export function RevokeGrantForm({
  familyId,
  grantId,
}: {
  familyId: string;
  grantId: string;
}) {
  const [pending, start] = useTransition();
  function onClick() {
    if (!confirm("确认撤销该授权？")) return;
    const fd = new FormData();
    fd.set("grantId", grantId);
    start(async () => {
      const res = await revokeSubtree(familyId, fd);
      if (res?.error) alert(res.error);
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
    >
      撤销
    </button>
  );
}

function labelOf(role: string) {
  return ROLE_OPTIONS.find((o) => o.v === role)?.l ?? role;
}

export function RevokeShareForm({
  familyId,
  id,
}: {
  familyId: string;
  id: string;
}) {
  const [pending, start] = useTransition();
  function onClick() {
    if (!confirm("撤销此分享链接？该 URL 将立即失效。")) return;
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      const res = await revokeShareLink(familyId, fd);
      if (res?.error) alert(res.error);
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
    >
      撤销
    </button>
  );
}

export function RevokeInviteForm({
  familyId,
  id,
}: {
  familyId: string;
  id: string;
}) {
  const [pending, start] = useTransition();
  function onClick() {
    if (!confirm("撤销此邀请码？该码将立即失效，已加入的成员不受影响。")) return;
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      const res = await revokeInvite(familyId, fd);
      if (res?.error) alert(res.error);
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
    >
      撤销
    </button>
  );
}

export function InviteCodeCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState<"none" | "code" | "url">("none");
  const formatted = formatInviteCode(code);
  async function copy(kind: "code" | "url") {
    const text =
      kind === "code"
        ? formatted
        : typeof window !== "undefined"
          ? `${window.location.origin}/join/${code}`
          : `/join/${code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied("none"), 1500);
    } catch {
      // ignore
    }
  }
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-sm tracking-wider">{formatted}</span>
      <button
        type="button"
        onClick={() => copy("code")}
        className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {copied === "code" ? "已复制" : "复制码"}
      </button>
      <button
        type="button"
        onClick={() => copy("url")}
        className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {copied === "url" ? "已复制" : "复制链接"}
      </button>
    </span>
  );
}

export function ShareTokenCopy({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/share/${token}`;
  async function copy() {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 用户拒绝剪贴板权限就静默
    }
  }
  return (
    <span className="flex items-center gap-2">
      <a
        href={path}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-xs text-blue-600 hover:underline"
      >
        /share/{token.slice(0, 10)}…
      </a>
      <button
        type="button"
        onClick={copy}
        className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {copied ? "已复制" : "复制链接"}
      </button>
    </span>
  );
}
