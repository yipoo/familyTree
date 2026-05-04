"use client";

import { useState } from "react";

import { MigrationsPanel } from "@/components/migrations/MigrationsPanel";

export function BranchMigrationsCard({
  familyId,
  branchId,
  branchName,
}: {
  familyId: string;
  branchId: string;
  branchName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2 text-left"
      >
        <span className="text-sm font-medium">{branchName}</span>
        <span className="text-xs text-zinc-500">{open ? "收起 ▴" : "展开 ▾"}</span>
      </button>
      {open && (
        <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <MigrationsPanel
            familyId={familyId}
            scope="BRANCH"
            branchId={branchId}
            canEdit={true}
          />
        </div>
      )}
    </div>
  );
}
