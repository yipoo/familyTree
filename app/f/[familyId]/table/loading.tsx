export default function Loading() {
  return (
    <div>
      <div className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-[1440px] px-3 py-5 sm:px-5 lg:px-6">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-6 w-40 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] space-y-2 p-3 sm:p-5 lg:p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg border border-border bg-panel"
          />
        ))}
      </div>
    </div>
  );
}
