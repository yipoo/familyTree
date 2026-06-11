export default function Loading() {
  return (
    <div>
      <div className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-[1440px] px-3 py-5 sm:px-5 lg:px-6">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-6 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] space-y-3 p-3 sm:p-5 lg:p-6">
        <div className="h-9 w-full animate-pulse rounded-lg bg-muted/60" />
        <div className="h-[70vh] animate-pulse rounded-lg border border-border bg-panel" />
      </div>
    </div>
  );
}
