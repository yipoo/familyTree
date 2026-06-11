"use client";

/**
 * 顶栏右侧的「+ 快捷新增」按钮（仅家族页）。
 *
 * 下拉项：
 * - 新增人物 → /f/[id]/admin/import （目前没有独立创建页，先指向导入）
 * - 新增婚配 / 亲子 → 直接跳转高级搜索辅助选人
 * - 新增迁徙 → /f/[id]/admin/migrations
 *
 * 之所以下拉而不是直接弹 Modal —— 实际表单分散在各页面，
 * 第一阶段先做集中入口。后续可改为弹真正的快捷创建对话框。
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  IconChevronDown,
  IconHeart,
  IconPlus,
  IconRoute,
  IconUser,
  IconUsers,
} from "./icons";

export function QuickAddMenu({ familyId }: { familyId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    {
      icon: IconUser,
      label: "新增人物",
      href: `/f/${familyId}/admin/import`,
      hint: "Excel 批量 / 从树视图右键",
    },
    {
      icon: IconHeart,
      label: "登记婚配",
      href: `/f/${familyId}/search?intent=marriage`,
      hint: "选两人后建关系",
    },
    {
      icon: IconUsers,
      label: "登记亲子",
      href: `/f/${familyId}/search?intent=parent`,
      hint: "父/母 → 子/女",
    },
    {
      icon: IconRoute,
      label: "记录迁徙",
      href: `/f/${familyId}/admin/migrations`,
      hint: "支系级 / 个人级",
    },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="hidden items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-brand-fg shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:inline-flex"
      >
        <IconPlus size={14} />
        <span>新增</span>
        <IconChevronDown size={12} />
      </button>
      {/* 移动端：仅图标 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="新增"
        className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-brand-fg shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:hidden"
      >
        <IconPlus size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-md border border-border bg-panel py-1 text-sm shadow-lg"
        >
          <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
            快捷新增
          </div>
          {items.map((it) => {
            const ItemIcon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-start gap-2.5 px-3 py-2 transition hover:bg-muted"
              >
                <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded bg-brand-soft text-brand-soft-fg">
                  <ItemIcon size={14} />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-medium text-foreground">
                    {it.label}
                  </span>
                  <span className="text-[11px] text-fg-subtle">{it.hint}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
