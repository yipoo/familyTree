export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 h-8 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-[480px] animate-pulse rounded-lg bg-white dark:bg-zinc-900" />
      </div>
    </div>
  );
}
