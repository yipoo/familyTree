/**
 * 营销页通用视觉元素：印章、纸面背景、章节容器、辈分柱、引言。
 * 全部 server 友好（无 hooks）。
 */
import Link from "next/link";

/* ──────────────────────────────────────────
   纸面背景 — 米白纸纹 + 边角晕染（默认主题）
   ────────────────────────────────────────── */
export function PaperBackdrop({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative isolate min-h-screen bg-[#fbf7ee] text-stone-900 dark:bg-[#0c0a09] dark:text-stone-100 ${className}`}
    >
      {/* 角落晕染 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(168,32,31,0.10),transparent_70%),radial-gradient(40%_40%_at_85%_15%,rgba(201,168,92,0.16),transparent_70%)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,rgba(168,32,31,0.18),transparent_70%),radial-gradient(40%_40%_at_85%_15%,rgba(201,168,92,0.10),transparent_70%)]"
      />
      {/* 纸纹 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] dark:opacity-[0.04] [background-image:radial-gradient(rgba(120,80,40,1)_0.5px,transparent_0.5px)] [background-size:6px_6px]"
      />
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────
   印章 — 朱红方印
   ────────────────────────────────────────── */
export function SealStamp({ children = "族", size = "md" }: { children?: React.ReactNode; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-20 w-20 text-3xl" : size === "sm" ? "h-10 w-10 text-base" : "h-14 w-14 text-xl";
  return (
    <span
      aria-hidden
      className={`relative inline-flex ${dim} -rotate-3 select-none items-center justify-center rounded-md bg-rose-700 font-serif font-bold tracking-tight text-rose-50 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.18),0_2px_8px_rgba(168,32,31,0.35)]`}
    >
      <span className="absolute inset-1 rounded-sm border border-rose-50/30" />
      {children}
    </span>
  );
}

/* ──────────────────────────────────────────
   章节标题 — 「卷首语」式
   ────────────────────────────────────────── */
export function SectionEyebrow({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-rose-700 uppercase dark:text-rose-400">
      <span className="h-px w-8 bg-rose-700/60 dark:bg-rose-400/60" />
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <h2
      className={`font-serif text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl ${
        align === "center" ? "text-center" : ""
      }`}
    >
      {children}
    </h2>
  );
}

/* ──────────────────────────────────────────
   CTA 按钮组
   ────────────────────────────────────────── */
export function PrimaryCTA({
  href,
  children,
  variant = "ink",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "ink" | "vermilion";
}) {
  const cls =
    variant === "vermilion"
      ? "bg-rose-700 text-rose-50 hover:bg-rose-800 shadow-md shadow-rose-900/20"
      : "bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-50 dark:text-stone-900 dark:hover:bg-stone-200";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition ${cls}`}
    >
      {children}
    </Link>
  );
}

export function SecondaryCTA({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white/60 px-5 py-2.5 text-sm font-medium text-stone-800 backdrop-blur transition hover:border-stone-400 hover:bg-white dark:border-stone-700 dark:bg-stone-900/40 dark:text-stone-100 dark:hover:bg-stone-900"
    >
      {children}
    </Link>
  );
}

/* ──────────────────────────────────────────
   分隔花纹
   ────────────────────────────────────────── */
export function Divider({ label }: { label?: string }) {
  return (
    <div className="my-12 flex items-center gap-4">
      <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
      {label ? (
        <span className="font-serif text-xs tracking-[0.3em] text-stone-500">
          {label}
        </span>
      ) : (
        <span aria-hidden className="text-stone-400">
          ◆
        </span>
      )}
      <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
    </div>
  );
}

/* ──────────────────────────────────────────
   引言（古风竖排短句）
   ────────────────────────────────────────── */
export function Quote({ children, source }: { children: React.ReactNode; source?: string }) {
  return (
    <blockquote className="rounded-r-md border-l-2 border-rose-700/60 bg-stone-100/60 px-5 py-3 font-serif text-base italic text-stone-700 dark:border-rose-400/60 dark:bg-stone-900/40 dark:text-stone-300">
      {children}
      {source && (
        <footer className="mt-1 text-xs not-italic text-stone-500">— {source}</footer>
      )}
    </blockquote>
  );
}
