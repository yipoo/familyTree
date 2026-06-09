export default function Loading() {
  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-muted/30">
      {/* 画布占位 */}
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_center,theme(colors.muted.DEFAULT)_0,transparent_70%)]" />
      {/* 顶部工具栏占位 */}
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 border-b border-hairline bg-surface/80 px-3 py-2 backdrop-blur sm:px-5 lg:px-6">
        <div className="h-7 w-24 animate-pulse rounded bg-muted" />
        <div className="h-7 w-16 animate-pulse rounded bg-muted" />
        <div className="ml-auto h-7 w-28 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
