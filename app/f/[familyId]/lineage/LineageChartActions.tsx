"use client";

/**
 * 吊线图操作工具条：根选择 / 打印（导出 PDF）/ 下载 SVG
 *
 * 打印：window.print()，页面通过 @media print / .print:hidden 切换到全图打印态
 * 下载 SVG：直接抓 main 内第一个 <svg>，序列化为 image/svg+xml
 * 下载 PDF：异步任务（PdfJobButton），适配大家族（10000+ 人）
 */
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { PdfJobButton } from "@/components/PdfJobButton";

export interface LineageBranchOption {
  id: string;
  name: string;
  rootPersonId: string;
  rootPersonName: string;
}

interface Props {
  familyId: string;
  rootId: string;
  branches: LineageBranchOption[];
}

export function LineageChartActions({ familyId, rootId, branches }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handlePrint() {
    window.print();
  }

  function handleDownloadSvg() {
    const svg = document.querySelector("main svg");
    if (!svg) return;
    const cloned = svg.cloneNode(true) as SVGElement;
    cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const xml = new XMLSerializer().serializeToString(cloned);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lineage-${familyId}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleSwitchRoot(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    startTransition(() => {
      router.push(`/f/${familyId}/lineage?root=${next}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {branches.length > 0 && (
        <select
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={rootId}
          onChange={handleSwitchRoot}
          disabled={pending}
        >
          {branches.map((b) => (
            <option key={b.rootPersonId} value={b.rootPersonId}>
              {b.name} · {b.rootPersonName}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={handleDownloadSvg}
        className="rounded border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        下载 SVG
      </button>
      <PdfJobButton
        familyId={familyId}
        type="LINEAGE_CHART"
        params={rootId ? { root: rootId } : {}}
        label="下载 PDF（服务端）"
      />
      <button
        type="button"
        onClick={handlePrint}
        className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
      >
        打印
      </button>
    </div>
  );
}
