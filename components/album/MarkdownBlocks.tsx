/**
 * Markdown → React DOM 薄渲染器（屏幕/打印端）。
 * 消费 lib/markdown/parse.ts 产出的 Block[]（受控结构，绝不 dangerouslySetInnerHTML）。
 *
 * 仅当用户为某章节填了自定义 markdown 正文（body 覆盖）时使用；默认/未覆盖的
 * 系统章节仍走 components/album/CompletePages.tsx 里既有的模板函数，保证向后兼容。
 *
 * 分页见 lib/markdown/paginate.ts（纯函数）。
 */
import * as React from "react";

import type { Block, Inline } from "@/lib/markdown/parse";

export function MarkdownBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </>
  );
}

/**
 * 字号/行高一律继承外层容器（em / inherit）——由 markdownSectionPages 按章节
 * 字数选档（lib/services/album-typo.ts），实现"少字大号铺满、多字降档分页"。
 */
function BlockView({ block }: { block: Block }) {
  if (block.t === "heading") {
    const cls =
      block.level === 1
        ? "mt-[1.1em] mb-[0.5em] text-[1.25em] font-semibold text-zinc-900"
        : block.level === 2
          ? "mt-[0.9em] mb-[0.4em] text-[1.12em] font-semibold text-zinc-900"
          : "mt-[0.7em] mb-[0.3em] text-[1em] font-semibold text-zinc-800";
    const inner = <Inlines inlines={block.inlines} />;
    if (block.level === 1) return <h3 className={cls}>{inner}</h3>;
    if (block.level === 2) return <h4 className={cls}>{inner}</h4>;
    return <h5 className={cls}>{inner}</h5>;
  }

  if (block.t === "list") {
    const cls = "my-[0.4em] ml-[1.6em] space-y-[0.25em] text-zinc-800";
    const items = block.items.map((it, i) => (
      <li key={i}>
        <Inlines inlines={it} />
      </li>
    ));
    return block.ordered ? (
      <ol className={`${cls} list-decimal`}>{items}</ol>
    ) : (
      <ul className={`${cls} list-disc`}>{items}</ul>
    );
  }

  // para
  return (
    <p className="my-[0.4em] indent-[2em] text-zinc-800">
      <Inlines inlines={block.inlines} />
    </p>
  );
}

function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((seg, i) =>
        seg.t === "strong" ? (
          <strong key={i} className="font-semibold text-zinc-900">
            <SoftBreaks text={seg.v} />
          </strong>
        ) : (
          <React.Fragment key={i}>
            <SoftBreaks text={seg.v} />
          </React.Fragment>
        ),
      )}
    </>
  );
}

/** 段内软换行：把 text 里的 "\n" 渲染为 <br/>。 */
function SoftBreaks({ text }: { text: string }) {
  const parts = text.split("\n");
  return (
    <>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {p}
        </React.Fragment>
      ))}
    </>
  );
}
