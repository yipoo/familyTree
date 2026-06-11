"use client";

import { PdfJobButton } from "@/components/PdfJobButton";

interface Props {
  familyId: string;
}

export function AlbumPrintActions({ familyId }: Props) {
  return (
    <div className="flex items-center gap-2">
      <PdfJobButton
        familyId={familyId}
        type="ALBUM"
        label="下载 PDF"
        className="rounded-md border border-border bg-panel px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
      />
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg shadow-sm transition hover:opacity-90"
      >
        打印
      </button>
    </div>
  );
}
