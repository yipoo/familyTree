"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Props {
  next: string;
  initialPhone?: string;
  initialError?: string | null;
}

const COOLDOWN_FALLBACK = 60;

export function CodeLoginForm({ next, initialPhone, initialError }: Props) {
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [sendOk, setSendOk] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const phoneOk = /^1[3-9]\d{9}$/.test(phone.replace(/\s|-/g, ""));

  async function send() {
    if (!phoneOk || cooldown > 0 || sending) return;
    setSending(true);
    setSendErr(null);
    setSendOk(false);
    try {
      const res = await fetch("/api/sms/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "LOGIN" }),
      });
      const j = (await res.json().catch(() => null)) as
        | { data?: { cooldownSec?: number }; error?: { message?: string; cooldownSec?: number } }
        | null;
      if (!res.ok) {
        setSendErr(j?.error?.message ?? `发送失败 (HTTP ${res.status})`);
        if (j?.error?.cooldownSec) setCooldown(j.error.cooldownSec);
        return;
      }
      setSendOk(true);
      setCooldown(j?.data?.cooldownSec ?? COOLDOWN_FALLBACK);
      // 自动聚焦到验证码输入
      setTimeout(() => codeInputRef.current?.focus(), 50);
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      method="POST"
      action="/api/login-code"
      className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <input type="hidden" name="next" value={next} />
      <h1 className="mb-1 text-xl font-semibold">登录</h1>
      <p className="mb-5 text-sm text-zinc-500">手机号 + 短信验证码</p>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-zinc-500">手机号</span>
        <input
          type="tel"
          name="phone"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="13800138000"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
          required
        />
      </label>

      <label className="mb-1 block">
        <span className="mb-1 block text-xs text-zinc-500">短信验证码</span>
        <div className="flex gap-2">
          <input
            ref={codeInputRef}
            type="text"
            name="code"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="\d{6}"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6 位"
            className="w-32 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tracking-[0.3em] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
            required
          />
          <button
            type="button"
            onClick={send}
            disabled={!phoneOk || cooldown > 0 || sending}
            className="flex-1 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
          >
            {sending
              ? "发送中…"
              : cooldown > 0
                ? `${cooldown}s 后重发`
                : sendOk
                  ? "重新获取"
                  : "获取验证码"}
          </button>
        </div>
      </label>

      {sendOk && (
        <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
          已发送至 {maskPhone(phone)}，5 分钟内有效
        </p>
      )}
      {sendErr && (
        <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
          {sendErr}
        </p>
      )}

      {initialError && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {initialError}
        </div>
      )}

      <button
        type="submit"
        disabled={!phoneOk || code.length !== 6}
        className="mt-4 w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        登录
      </button>

      <div className="mt-4 flex items-center justify-between text-xs">
        <Link
          href={`/login${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-blue-600 hover:underline"
        >
          ← 用密码登录
        </Link>
        <Link
          href={`/register${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-zinc-500 hover:underline"
        >
          注册
        </Link>
      </div>
    </form>
  );
}

function maskPhone(p: string) {
  const c = p.replace(/\s|-/g, "");
  if (c.length !== 11) return c;
  return `${c.slice(0, 3)}****${c.slice(7)}`;
}
