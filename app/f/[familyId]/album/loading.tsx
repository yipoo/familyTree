export default function Loading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-panel" />
        <div className="h-32 animate-pulse rounded-lg border border-border bg-panel" />
        <div className="h-48 animate-pulse rounded-lg border border-border bg-panel" />
      </div>
    </div>
  );
}
