"use client";

interface Props {
  familyId: string;
}

export function AlbumPrintActions({ familyId }: Props) {
  return (
    <div className="flex items-center gap-2">
      <a
        href={`/api/families/${familyId}/album/pdf`}
        className="rounded border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        下载 PDF
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
      >
        打印
      </button>
    </div>
  );
}
