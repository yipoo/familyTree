export default function Loading() {
  return (
    <div className="bg-gradient-to-b from-zinc-100 to-zinc-200 dark:from-zinc-950 dark:to-zinc-900">
      <div className="border-b border-hairline bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-end justify-between gap-3 px-3 py-4 sm:px-5 lg:px-6">
          <div>
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-6 w-48 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-8 w-28 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] px-3 py-8 sm:px-5 lg:px-6">
        <div className="mx-auto aspect-[14/9] w-full animate-pulse rounded-lg border border-border bg-panel shadow-sm" />
        <p className="mt-4 text-center text-xs text-fg-muted">正在排版成册…</p>
      </div>
    </div>
  );
}
