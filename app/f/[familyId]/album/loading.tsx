export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-8 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-64 animate-pulse rounded-lg bg-white dark:bg-zinc-900" />
        <div className="h-32 animate-pulse rounded-lg bg-white dark:bg-zinc-900" />
        <div className="h-48 animate-pulse rounded-lg bg-white dark:bg-zinc-900" />
      </div>
    </div>
  );
}
