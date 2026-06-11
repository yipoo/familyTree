/**
 * 世系详录·紧凑表格（参照 1995 四修谱 p27 版式）。
 *
 * 按世代分列（6 列与吊线图分块的 6 代对齐），每格一人：
 *   名（字辈）｜妻某氏｜子N：名 名 名
 * 行内靠列位自明父子（与吊线图同一 detailRows 数据源，HTML 与 PDF 同构），
 * 多个小块连排在同一页，块间以细线分隔——紧凑而不失层次。
 */
import * as React from "react";

import {
  DETAIL_COLS,
  type LineageChunk,
} from "@/lib/services/lineage-chunks";

export function TuluDetailTable({ chunk }: { chunk: LineageChunk }) {
  const cols = DETAIL_COLS;
  return (
    <div className="mb-3 break-inside-avoid">
      {/* 块头：根公 + 世代列头 */}
      <p className="mb-1 text-[11px] text-zinc-500">
        自 {chunk.startGen} 世「{chunk.rootName}」起
      </p>
      <div
        className="grid border-b border-zinc-400 pb-0.5 text-center text-[10px] font-medium text-zinc-600"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }, (_, c) => (
          <span key={c}>{chunk.startGen + c} 世</span>
        ))}
      </div>
      {chunk.detailRows.map((row, ri) => (
        <div
          key={ri}
          className="grid border-b border-dotted border-zinc-200"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }, (_, c) => {
            const cell = row.find((x) => x.col === c);
            return (
              <div key={c} className="min-w-0 px-0.5 py-0.5">
                {cell && (
                  <p className="text-[10px] leading-4 text-zinc-800">
                    <span
                      className="font-semibold text-zinc-900"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {cell.name}
                    </span>
                    {cell.annotation && (
                      <span className="text-zinc-500"> {cell.annotation}</span>
                    )}
                    {cell.wives.length > 0 && (
                      <span className="text-zinc-600">
                        　妻{cell.wives.join("、")}
                      </span>
                    )}
                    {cell.sons.length > 0 && (
                      <span className="text-zinc-600">
                        　子{numToHan(cell.sons.length)}：{cell.sons.join(" ")}
                      </span>
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function numToHan(n: number): string {
  const map = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (n <= 10) return map[n];
  if (n < 20) return "十" + map[n - 10];
  return String(n);
}
