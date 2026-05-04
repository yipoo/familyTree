export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-7 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg bg-white shadow-sm dark:bg-zinc-900"
              />
            ))}
          </div>
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-lg bg-white dark:bg-zinc-900" />
            <div className="h-32 animate-pulse rounded-lg bg-white dark:bg-zinc-900" />
          </div>
        </div>
      </div>
    </div>
  );
}
