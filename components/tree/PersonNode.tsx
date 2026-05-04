"use client";
import { useContext } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { TREE_LAYOUT_CONSTS } from "@/lib/services/tree-layout";
import { SelectedIdContext } from "@/components/tree/TreeCanvas";

export interface PersonNodeData {
  name: string;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  generationChar: string | null;
  isMarriedIn: boolean;
  status: string;
  isCollapsed?: boolean;
  hasChildren?: boolean;
  isSelected?: boolean;
  residenceShort?: string | null;
  residenceFull?: string | null;
  residenceInherited?: boolean;
  residenceColor?: string | null;
  [key: string]: unknown;
}

const { NODE_W, NODE_H } = TREE_LAYOUT_CONSTS;
const AVATAR_H = 50; // 顶部头像区高度

/** 性别轮廓：仅占节点上方一段；姓名永远是主视觉 */
function SilhouetteBg({ gender }: { gender: PersonNodeData["gender"] }) {
  const stroke =
    gender === "FEMALE"
      ? "#be185d"
      : gender === "MALE"
        ? "#1d4ed8"
        : "#52525b";
  const fill =
    gender === "FEMALE"
      ? "#fbcfe8"
      : gender === "MALE"
        ? "#bfdbfe"
        : "#e4e4e7";

  return (
    <svg
      viewBox="0 0 32 28"
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* 头 */}
      <circle cx="16" cy="10" r="5.5" fill={fill} stroke={stroke} strokeWidth="1.2" />
      {/* 肩 */}
      <path
        d="M4 28c0-6 5-10 12-10s12 4 12 10"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PersonNode({ id, data, selected }: NodeProps) {
  const d = data as PersonNodeData;
  const isMale = d.gender === "MALE";
  const isFemale = d.gender === "FEMALE";
  // 选中态从 Context 读取，避免父级把 isSelected 写进所有 10K 节点的 data
  const selectedId = useContext(SelectedIdContext);
  const hit = selectedId === id || !!d.isSelected || !!selected;

  // 整体外框 / 主体配色
  const frameClass = hit
    ? "bg-amber-100 border-amber-500 dark:bg-amber-950/70 dark:border-amber-400"
    : isMale
      ? "bg-blue-100 border-blue-400 dark:bg-blue-950/60 dark:border-blue-600"
      : isFemale
        ? "bg-pink-100 border-pink-400 dark:bg-pink-950/60 dark:border-pink-600"
        : "bg-zinc-100 border-zinc-400 dark:bg-zinc-800 dark:border-zinc-600";

  // 头像区背景：比主体更深一档（命中态用更醒目的橙色）
  const avatarBgClass = hit
    ? "bg-amber-300 dark:bg-amber-700"
    : isMale
      ? "bg-blue-200 dark:bg-blue-900/70"
      : isFemale
        ? "bg-pink-200 dark:bg-pink-900/70"
        : "bg-zinc-200 dark:bg-zinc-700";

  const textClass = hit
    ? "text-amber-900 dark:text-amber-100"
    : isMale
      ? "text-blue-900 dark:text-blue-100"
      : isFemale
        ? "text-pink-900 dark:text-pink-100"
        : "text-zinc-700 dark:text-zinc-200";

  const chars = Array.from(d.name);
  const fontSizeClass =
    chars.length <= 2
      ? "text-base"
      : chars.length === 3
        ? "text-sm"
        : "text-xs";

  const residenceTooltip = d.residenceFull
    ? d.residenceInherited
      ? `居住地：${d.residenceFull}（继承）`
      : `居住地：${d.residenceFull}`
    : undefined;

  return (
    <div
      style={{ width: NODE_W, height: NODE_H }}
      title={residenceTooltip}
      className={`relative flex flex-col items-stretch overflow-hidden rounded-md border-2 ${frameClass} ${
        hit
          ? "scale-110 shadow-lg ring-2 ring-amber-400 ring-offset-2"
          : "shadow-sm hover:shadow-md"
      } transition-all`}
    >
      <Handle id="top" type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle id="left" type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle id="right" type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: "none" }} />

      {/* 居住地色条（顶部） */}
      {d.residenceColor && (
        <div
          style={{ background: d.residenceColor }}
          className="absolute left-0 right-0 top-0 h-1.5"
          aria-hidden
        />
      )}

      {/* 头像区（位于姓名上方） */}
      <div
        style={{ height: AVATAR_H }}
        className={`relative shrink-0 ${avatarBgClass}`}
      >
        <SilhouetteBg gender={d.gender} />
      </div>

      {/* 姓名区（竖排，每字一行） */}
      <div
        className={`flex flex-1 flex-col items-center justify-center gap-0 ${textClass}`}
      >
        {chars.map((ch, i) => (
          <span key={i} className={`block leading-tight ${fontSizeClass} font-semibold`}>
            {ch}
          </span>
        ))}
      </div>

      {/* 角标 */}
      {d.status === "DECEASED" && (
        <div className="absolute right-1 top-0.5 text-[9px] leading-none text-zinc-500">†</div>
      )}
      {d.isMarriedIn && (
        <div className="absolute bottom-0.5 left-1 text-[9px] leading-none opacity-70">嫁</div>
      )}
      {/* 折叠指示器：底部正中显示一个"+"，提示有被隐藏的后代 */}
      {d.isCollapsed && d.hasChildren && (
        <div className="absolute -bottom-1 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold leading-none text-white shadow ring-1 ring-white">
          +
        </div>
      )}

      {/* 居住地短名（村名）：贴在卡片底部 */}
      {d.residenceShort && (
        <div
          className={`pointer-events-none w-full shrink-0 truncate px-0.5 pb-0.5 text-center text-[9px] leading-tight ${
            d.residenceInherited
              ? "italic text-zinc-500 dark:text-zinc-500"
              : "font-medium text-zinc-700 dark:text-zinc-300"
          }`}
        >
          {d.residenceShort}
        </div>
      )}
    </div>
  );
}
