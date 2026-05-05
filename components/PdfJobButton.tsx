"use client";

/**
 * 通用 PDF 异步下载按钮。
 *
 * 流程：
 *   1. 点击 → POST /api/families/[fid]/pdf-jobs 拿 jobId
 *   2. 轮询 GET /pdf-jobs/[id]，刷新进度条
 *   3. status=DONE → 触发下载 /pdf-jobs/[id]/download
 *   4. status=FAILED → 显示错误
 *
 * 用户可中途点"取消" → DELETE /pdf-jobs/[id]
 */
import { useEffect, useRef, useState } from "react";

interface JobStatus {
  id: string;
  type: "LINEAGE_CHART" | "ALBUM";
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "CANCELED";
  progress: number;
  error: string | null;
  outputName: string | null;
}

interface Props {
  familyId: string;
  type: "LINEAGE_CHART" | "ALBUM";
  params?: Record<string, unknown>;
  label?: string;
  className?: string;
}

export function PdfJobButton({
  familyId,
  type,
  params,
  label = "下载 PDF",
  className,
}: Props) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => {
    return () => clearPoll();
  }, []);

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/families/${familyId}/pdf-jobs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, params: params ?? {} }),
      });
      const j = (await res.json()) as { data?: { id: string }; error?: { message?: string } };
      if (!res.ok || !j.data?.id) {
        throw new Error(j.error?.message ?? "创建任务失败");
      }
      const jobId = j.data.id;
      setJob({
        id: jobId,
        type,
        status: "PENDING",
        progress: 0,
        error: null,
        outputName: null,
      });
      poll(jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function poll(jobId: string) {
    clearPoll();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/families/${familyId}/pdf-jobs/${jobId}`);
        if (!res.ok) {
          // 401 / 403 等：停止轮询
          clearPoll();
          setError("查询任务失败");
          return;
        }
        const { data } = (await res.json()) as { data: JobStatus };
        setJob(data);
        if (data.status === "DONE") {
          clearPoll();
          // 直接触发下载
          window.location.href = `/api/families/${familyId}/pdf-jobs/${jobId}/download`;
        } else if (data.status === "FAILED" || data.status === "CANCELED") {
          clearPoll();
          if (data.status === "FAILED") setError(data.error ?? "渲染失败");
        }
      } catch (e) {
        clearPoll();
        setError(e instanceof Error ? e.message : "网络错误");
      }
    }, 1500);
  }

  async function cancel() {
    if (!job) return;
    clearPoll();
    try {
      await fetch(`/api/families/${familyId}/pdf-jobs/${job.id}`, { method: "DELETE" });
    } catch {
      /* ignore */
    }
    setJob(null);
  }

  function reset() {
    clearPoll();
    setJob(null);
    setError(null);
  }

  const buttonClass =
    className ??
    "rounded border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

  if (!job || job.status === "DONE" || job.status === "FAILED" || job.status === "CANCELED") {
    return (
      <div className="inline-flex items-center gap-2">
        <button type="button" disabled={busy} onClick={start} className={buttonClass}>
          {busy ? "提交中…" : label}
        </button>
        {error && (
          <span className="text-xs text-red-600">
            {error}{" "}
            <button type="button" onClick={reset} className="underline">
              知道了
            </button>
          </span>
        )}
        {job?.status === "DONE" && (
          <span className="text-xs text-emerald-600">已完成</span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className="inline-flex w-32 items-center gap-1.5 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
        title={`任务状态：${job.status}`}
      >
        <span className="h-1.5 flex-1 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
          <span
            className="block h-full bg-blue-500 transition-[width]"
            style={{ width: `${Math.max(5, job.progress)}%` }}
          />
        </span>
        <span className="tabular-nums">{job.progress}%</span>
      </span>
      <button
        type="button"
        onClick={cancel}
        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        取消
      </button>
    </div>
  );
}
