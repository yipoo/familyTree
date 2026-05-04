"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";

const TABS: { key: "paternal" | "maternal" | "all"; label: string }[] = [
  { key: "paternal", label: "父系" },
  { key: "maternal", label: "母系" },
  { key: "all", label: "全部" },
];

export function LineageTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = (params.get("lineage") as "paternal" | "maternal" | "all") ?? "paternal";

  const make = useMemo(
    () =>
      (key: string) => {
        const sp = new URLSearchParams(params.toString());
        sp.set("lineage", key);
        return `${pathname}?${sp.toString()}`;
      },
    [pathname, params],
  );

  return (
    <div
      role="tablist"
      className="inline-flex gap-1 rounded-full bg-zinc-100 p-1 text-xs dark:bg-zinc-800"
    >
      {TABS.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={make(t.key)}
            role="tab"
            aria-selected={active}
            className={`rounded-full px-3 py-1 transition ${
              active
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
