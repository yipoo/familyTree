export default function Loading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 h-8 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-[480px] animate-pulse rounded-lg border border-border bg-panel" />
      </div>
    </div>
  );
}
