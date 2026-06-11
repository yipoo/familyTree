export default function Loading() {
  return (
    <div>
      <div className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-[1440px] px-3 py-5 sm:px-5 lg:px-6">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-6 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] p-3 sm:p-5 lg:p-6">
        <div className="grid h-[72vh] animate-pulse place-items-center rounded-lg border border-border bg-panel">
          <div className="h-64 w-64 rounded-full bg-muted/70" />
        </div>
      </div>
    </div>
  );
}
