"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LayoutIndex } from "@/lib/services/layout-index";
import { PersonSearch, type SearchResult } from "@/components/PersonSearch";
import { ResidenceField } from "@/components/tree/ResidenceField";
import { SuggestEditPanel } from "@/components/tree/SuggestEditPanel";
import { MiniRelationGraph } from "@/components/tree/MiniRelationGraph";

export interface PopupPerson {
  id: string;
  name: string;
  alias: string | null;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  generation: number;
  generationChar: string | null;
  birthOrder: number | null;
  status: string;
  isMarriedIn: boolean;
}

export interface PersonInspectorProps {
  familyId: string;
  personId: string | null;
  /** O(1) 查询关系索引（TreeView 在 layout 变化时构建一次） */
  layoutIndex: LayoutIndex | null;
  /** 删除人物或显式取消选择时回调，用于清除外部 selectedId */
  onClearSelection?: () => void;
  /** 居住地映射，由 TreeView 透传，用于头部显示短名 */
  residenceByPersonId?: Record<
    string,
    { fullText: string; short: string; fromPersonId: string; inherited: boolean }
  >;
}

type Kind = "father" | "mother" | "spouse" | "son" | "daughter" | "brother" | "sister";

const KIND_LABEL: Record<Kind, string> = {
  father: "父亲",
  mother: "母亲",
  spouse: "配偶",
  son: "儿子",
  daughter: "女儿",
  brother: "兄弟",
  sister: "姐妹",
};

export function PersonInspector({
  familyId,
  personId,
  layoutIndex,
  onClearSelection,
  residenceByPersonId,
}: PersonInspectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = `/f/${familyId}/tree`;
  // 跳转到指定人物：写入 ?locate=PID&n=NONCE，TreeCanvas 监听后居中并更新 selectedId
  function jumpTo(id: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("locate", id);
    sp.set("n", String(Date.now()));
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<Kind | null>(null);
  const [editingParents, setEditingParents] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  // 折叠区状态：默认 关系图 + 关系列表 展开，其它折叠
  // "信息"由头部的铅笔图标进入编辑态；不再作为独立的折叠区
  const [open, setOpen] = useState({
    graph: true,
    relations: true,
    add: false,
    view: false,
    danger: false,
  });
  const toggle = (k: keyof typeof open) =>
    setOpen((prev) => ({ ...prev, [k]: !prev[k] }));

  // 关系图延迟挂载：先把其它信息渲染出来，让 inspector 立刻可见
  const [graphReady, setGraphReady] = useState(false);
  useEffect(() => {
    setGraphReady(false);
    if (!personId) return;
    type IdleId = number;
    type IdleAPI = {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => IdleId;
      cancelIdleCallback?: (id: IdleId) => void;
    };
    const w = window as unknown as IdleAPI;
    let idle: IdleId | null = null;
    let to: ReturnType<typeof setTimeout> | null = null;
    if (w.requestIdleCallback) {
      idle = w.requestIdleCallback(() => setGraphReady(true), { timeout: 200 });
    } else {
      to = setTimeout(() => setGraphReady(true), 50);
    }
    return () => {
      if (idle != null && w.cancelIdleCallback) w.cancelIdleCallback(idle);
      if (to) clearTimeout(to);
    };
  }, [personId]);

  // 当切换到不同人物时，重置内部编辑状态
  // 注：使用 personId 作为 dep；编辑/添加表单保持局部状态
  // 之前的 useEffect 已不需要

  // 全部通过预构建索引 O(1) 查询，避免每次点击都 O(E×N)
  const node = personId ? layoutIndex?.nodesById.get(personId) ?? null : null;
  const person = node?.person as PopupPerson | undefined;

  const parents = personId ? layoutIndex?.parentsOf.get(personId) ?? [] : [];
  const spouses = personId ? layoutIndex?.spousesOf.get(personId) ?? [] : [];
  const children = personId ? layoutIndex?.childrenOf.get(personId) ?? [] : [];

  function refresh() {
    startTransition(() => router.refresh());
  }

  function gotoCenter() {
    if (!personId) return;
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("focus", personId);
    sp.delete("root");
    router.push(`/f/${familyId}/tree?${sp.toString()}`);
  }
  function gotoBranchOnly() {
    if (!personId) return;
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("root", personId);
    sp.delete("focus");
    router.push(`/f/${familyId}/tree?${sp.toString()}`);
  }
  function clearCenter() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("root");
    sp.delete("focus");
    const qs = sp.toString();
    router.push(`/f/${familyId}/tree${qs ? `?${qs}` : ""}`);
  }

  async function handleDelete() {
    if (!personId) return;
    if (!confirm(`确认删除「${person?.name}」？\n（软删除，可后续恢复）`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/families/${familyId}/persons/${personId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      onClearSelection?.();
      refresh();
    } catch (e) {
      alert("删除失败：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  // 智能隐藏：哪些"添加亲属"按钮应当显示
  const hasFather = parents.some((p) => p.person.gender === "MALE");
  const hasMother = parents.some((p) => p.person.gender === "FEMALE");
  const isFirstGen = !!person && person.generation <= 1;
  const canAdd: Record<Kind, boolean> = {
    father: !!person && !isFirstGen && !hasFather,
    mother: !!person && !isFirstGen && !hasMother,
    brother: !!person && !person.isMarriedIn && parents.length > 0,
    sister: !!person && !person.isMarriedIn && parents.length > 0,
    spouse: !!person,
    son: !!person,
    daughter: !!person,
  };
  const hasCenter = !!searchParams.get("focus") || !!searchParams.get("root");

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {!person ? (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-400">
          点击左侧任一节点查看详情
        </div>
      ) : (
        <>
          {/* 头部 */}
          <div className="flex items-start justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${
                  person.gender === "MALE"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200"
                    : person.gender === "FEMALE"
                      ? "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-200"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800"
                }`}
              >
                {person.name.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-lg font-semibold leading-tight">
                    {person.name}
                  </h3>
                  <button
                    onClick={() => setEditing((v) => !v)}
                    className={`shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 ${
                      editing ? "bg-blue-50 text-blue-600 dark:bg-blue-950" : ""
                    }`}
                    aria-label={editing ? "取消编辑" : "编辑"}
                    title={editing ? "取消编辑" : "编辑"}
                  >
                    <PencilIcon />
                  </button>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-zinc-500">
                  <span>{person.generation} 世</span>
                  {person.generationChar && (
                    <span className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                      {person.generationChar}
                    </span>
                  )}
                  <span>·</span>
                  <span>
                    {person.gender === "MALE"
                      ? "男"
                      : person.gender === "FEMALE"
                        ? "女"
                        : "未知"}
                  </span>
                  {typeof person.birthOrder === "number" && person.birthOrder > 0 && (
                    <>
                      <span>·</span>
                      <span>排行 {person.birthOrder}</span>
                    </>
                  )}
                  {person.isMarriedIn && (
                    <span className="rounded bg-amber-100 px-1 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      嫁入
                    </span>
                  )}
                  {person.status === "DECEASED" && (
                    <span className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                      已故
                    </span>
                  )}
                </div>
                {/* 居住地：单独一行，便于阅读 */}
                {(() => {
                  const r = residenceByPersonId?.[person.id];
                  if (!r?.short) return null;
                  return (
                    <div
                      className={`mt-1 flex items-center gap-1 text-[11px] ${
                        r.inherited
                          ? "text-zinc-400"
                          : "text-zinc-700 dark:text-zinc-300"
                      }`}
                      title={r.fullText}
                    >
                      <PinIcon />
                      <span className="truncate">{r.short}</span>
                      {r.inherited && (
                        <span className="text-[10px] text-zinc-400">(继承)</span>
                      )}
                    </div>
                  );
                })()}
                {person.alias && (
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    别名：{person.alias}
                  </div>
                )}
              </div>
            </div>
            {onClearSelection && (
              <button
                onClick={onClearSelection}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                aria-label="关闭"
                title="关闭"
              >
                ✕
              </button>
            )}
          </div>

          {/* 编辑态：紧贴头部展示编辑面板（包含基础字段 + 居住地） */}
          {editing && (
            <div className="border-b border-zinc-200 bg-blue-50/30 px-4 py-3 dark:border-zinc-800 dark:bg-blue-950/20">
              <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-blue-800 dark:text-blue-300">
                编辑信息
              </div>
              <EditForm
                familyId={familyId}
                person={person}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  refresh();
                }}
              />
              <div className="mt-3 border-t border-blue-100 pt-3 dark:border-blue-900">
                <ResidenceField
                  familyId={familyId}
                  personId={person.id}
                  canEdit
                />
              </div>
            </div>
          )}

          {/* 主体：可滚动 */}
          <div className="flex-1 overflow-y-auto">
            {/* 关系图 */}
            <Disclosure
              title="关系图"
              hint="上 3 代 / 下 1 代"
              open={open.graph}
              onToggle={() => toggle("graph")}
            >
              {layoutIndex && graphReady ? (
                <MiniRelationGraph
                  personId={person.id}
                  index={layoutIndex}
                  onJump={jumpTo}
                />
              ) : (
                <div className="flex items-center justify-center rounded-md bg-zinc-50 py-6 text-xs text-zinc-400 dark:bg-zinc-800/40">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
                    准备关系图…
                  </div>
                </div>
              )}
            </Disclosure>

            {/* 关系列表 */}
            <Disclosure
              title="关系"
              hint={`父母 ${parents.length} · 配偶 ${spouses.length} · 子女 ${children.length}`}
              open={open.relations}
              onToggle={() => toggle("relations")}
            >
              {!editingParents ? (
                <div className="space-y-3">
                  <ChipGroup label="父母" items={parents} onJump={jumpTo} />
                  <ChipGroup label="配偶" items={spouses} onJump={jumpTo} />
                  <ChipGroup label="子女" items={children} onJump={jumpTo} />
                  {!isFirstGen && (
                    <BtnLink onClick={() => setEditingParents(true)}>
                      更改父母 →
                    </BtnLink>
                  )}
                </div>
              ) : (
                <ChangeParentsForm
                  familyId={familyId}
                  personId={person.id}
                  currentParents={parents.map((p) => ({
                    id: p.id,
                    name: p.person.name,
                    gender: p.person.gender,
                  }))}
                  onCancel={() => setEditingParents(false)}
                  onSaved={() => {
                    setEditingParents(false);
                    refresh();
                  }}
                />
              )}
            </Disclosure>

            {/* 添加亲属 */}
            <Disclosure
              title="添加亲属"
              open={open.add}
              onToggle={() => toggle("add")}
            >
              {adding ? (
                <AddRelativeForm
                  familyId={familyId}
                  personId={person.id}
                  kind={adding}
                  onCancel={() => setAdding(null)}
                  onCreated={() => {
                    setAdding(null);
                    refresh();
                  }}
                />
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(KIND_LABEL) as Kind[])
                    .filter((k) => canAdd[k])
                    .map((k) => (
                      <PillBtn
                        key={k}
                        onClick={() => setAdding(k)}
                        variant={
                          k === "mother" ||
                          k === "daughter" ||
                          k === "sister" ||
                          (k === "spouse" && person.gender === "MALE")
                            ? "pink"
                            : "blue"
                        }
                      >
                        + {KIND_LABEL[k]}
                      </PillBtn>
                    ))}
                  {(Object.keys(KIND_LABEL) as Kind[]).every((k) => !canAdd[k]) && (
                    <div className="col-span-3 text-xs text-zinc-400">
                      暂无可添加的关系类型
                    </div>
                  )}
                </div>
              )}
            </Disclosure>

            {/* 视图操作 */}
            <Disclosure
              title="视图"
              open={open.view}
              onToggle={() => toggle("view")}
            >
              <div className="grid grid-cols-2 gap-1.5">
                <PillBtn onClick={gotoCenter}>设为中心</PillBtn>
                <PillBtn onClick={gotoBranchOnly}>仅看此分支</PillBtn>
                {hasCenter && (
                  <PillBtn onClick={clearCenter} variant="ghost">
                    展开所有分支
                  </PillBtn>
                )}
              </div>
            </Disclosure>

            {/* 更多 / 危险 */}
            <Disclosure
              title="更多"
              open={open.danger}
              onToggle={() => toggle("danger")}
            >
              {suggesting ? (
                <SuggestEditPanel
                  familyId={familyId}
                  person={{
                    id: person.id,
                    name: person.name,
                    alias: person.alias,
                  }}
                  onCancel={() => setSuggesting(false)}
                  onSubmitted={() => setSuggesting(false)}
                />
              ) : (
                <div className="space-y-1.5">
                  <PillBtn
                    onClick={() => setSuggesting(true)}
                    variant="ghost"
                  >
                    建议修改（待审）
                  </PillBtn>
                  <PillBtn
                    onClick={handleDelete}
                    disabled={busy}
                    variant="danger"
                  >
                    删除人物
                  </PillBtn>
                </div>
              )}
            </Disclosure>

            {pending && (
              <div className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800">
                正在刷新…
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

// ---------------- 子组件 ----------------

function Disclosure({
  title,
  hint,
  open,
  onToggle,
  right,
  children,
}: {
  title: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-zinc-100 dark:border-zinc-800">
      <div className="flex w-full items-center gap-2 pr-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 px-4 py-2.5 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
        >
          <span
            className={`text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden
          >
            ▶
          </span>
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {title}
          </span>
          {hint && <span className="text-xs text-zinc-400">{hint}</span>}
        </button>
        {right && <div>{right}</div>}
      </div>
      {open && <div className="px-4 pb-3">{children}</div>}
    </section>
  );
}

function ChipGroup({
  label,
  items,
  onJump,
}: {
  label: string;
  items: { id: string; person: { name: string; gender: string; status: string } }[];
  onJump?: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
        <span className="ml-1 text-zinc-400">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-zinc-400">—</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => onJump?.(it.id)}
              className={`rounded-md px-2 py-0.5 text-sm transition hover:opacity-80 ${
                it.person.gender === "MALE"
                  ? "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
                  : it.person.gender === "FEMALE"
                    ? "bg-pink-50 text-pink-900 dark:bg-pink-950 dark:text-pink-200"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800"
              }`}
            >
              {it.person.name}
              {it.person.status === "DECEASED" && (
                <span className="ml-1 opacity-60">†</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PillBtn({
  onClick,
  disabled,
  variant = "default",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger" | "blue" | "pink" | "ghost";
  children: React.ReactNode;
}) {
  const cls = {
    default:
      "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700",
    danger:
      "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-200",
    blue:
      "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200",
    pink:
      "bg-pink-50 text-pink-700 hover:bg-pink-100 dark:bg-pink-950 dark:text-pink-200",
    ghost:
      "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}

function BtnLink({
  onClick,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-blue-600 hover:underline"
    >
      {children}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function EditForm({
  familyId,
  person,
  onCancel,
  onSaved,
}: {
  familyId: string;
  person: PopupPerson;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(person.name);
  const [gender, setGender] = useState(person.gender);
  const [alias, setAlias] = useState(person.alias ?? "");
  const [birthOrder, setBirthOrder] = useState<string>(
    person.birthOrder != null ? String(person.birthOrder) : "",
  );
  const [status, setStatus] = useState(person.status);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/families/${familyId}/persons/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          gender,
          alias: alias || null,
          birthOrder: birthOrder ? Number(birthOrder) : null,
          status,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } catch (e) {
      alert("保存失败：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <Input label="姓名" value={name} onChange={setName} />
      <Input label="别名" value={alias} onChange={setAlias} />
      <RadioRow
        label="性别"
        value={gender}
        onChange={(v) => setGender(v as PopupPerson["gender"])}
        options={[
          { value: "MALE", label: "男" },
          { value: "FEMALE", label: "女" },
          { value: "UNKNOWN", label: "未知" },
        ]}
      />
      <RadioRow
        label="状态"
        value={status}
        onChange={setStatus}
        options={[
          { value: "ALIVE", label: "在世" },
          { value: "DECEASED", label: "已故" },
          { value: "LOST", label: "失联" },
          { value: "UNKNOWN", label: "未知" },
        ]}
      />
      <SmallNumberInput
        label="排行"
        value={birthOrder}
        onChange={setBirthOrder}
        max={10}
      />
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          取消
        </button>
        <button
          onClick={submit}
          disabled={busy || !name.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          保存
        </button>
      </div>
    </div>
  );
}

function AddRelativeForm({
  familyId,
  personId,
  kind,
  onCancel,
  onCreated,
}: {
  familyId: string;
  personId: string;
  kind: Kind;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [birthOrder, setBirthOrder] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/families/${familyId}/persons/${personId}/relatives`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            name,
            alias: alias || null,
            birthOrder: birthOrder ? Number(birthOrder) : null,
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      onCreated();
    } catch (e) {
      alert("添加失败：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">添加 {KIND_LABEL[kind]}</h4>
      <Input label="姓名" value={name} onChange={setName} placeholder="必填" />
      <Input label="别名" value={alias} onChange={setAlias} />
      {(kind === "son" || kind === "daughter" || kind === "brother" || kind === "sister") && (
        <SmallNumberInput
          label="排行"
          value={birthOrder}
          onChange={setBirthOrder}
          max={10}
        />
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          取消
        </button>
        <button
          onClick={submit}
          disabled={busy || !name.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          创建
        </button>
      </div>
    </div>
  );
}

function ChangeParentsForm({
  familyId,
  personId,
  currentParents,
  onCancel,
  onSaved,
}: {
  familyId: string;
  personId: string;
  currentParents: { id: string; name: string; gender: string }[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const curFather = currentParents.find((p) => p.gender === "MALE");
  const curMother = currentParents.find((p) => p.gender === "FEMALE");
  const [father, setFather] = useState<SearchResult | null>(
    curFather ? makeFakeRef(curFather) : null,
  );
  const [mother, setMother] = useState<SearchResult | null>(
    curMother ? makeFakeRef(curMother) : null,
  );
  const [clearFather, setClearFather] = useState(false);
  const [clearMother, setClearMother] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const body: Record<string, string | null> = {};
      // 仅当选了新父亲 / 新母亲，或显式点了清除，才发送对应字段
      if (clearFather) body.fatherId = null;
      else if (father && father.id !== curFather?.id) body.fatherId = father.id;
      if (clearMother) body.motherId = null;
      else if (mother && mother.id !== curMother?.id) body.motherId = mother.id;

      if (Object.keys(body).length === 0) {
        onSaved();
        return;
      }
      const res = await fetch(
        `/api/families/${familyId}/persons/${personId}/parents`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } catch (e) {
      alert("保存失败：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">更改父母</h4>

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs text-zinc-500">父亲</span>
          <span className="text-[11px] text-zinc-400">
            当前：{curFather?.name ?? "—"}
          </span>
        </div>
        {clearFather ? (
          <div className="flex items-center justify-between rounded-md bg-zinc-100 px-3 py-1.5 text-sm dark:bg-zinc-800">
            <span className="text-zinc-500">将清除父亲关系</span>
            <button
              onClick={() => setClearFather(false)}
              className="text-xs text-blue-600 hover:underline"
            >
              撤销
            </button>
          </div>
        ) : father ? (
          <div className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-1.5 text-sm dark:bg-blue-950">
            <span>{father.name}（{father.generation} 世）</span>
            <button
              onClick={() => setFather(null)}
              className="text-xs text-blue-600 hover:underline"
            >
              重选
            </button>
          </div>
        ) : (
          <PersonSearch
            familyId={familyId}
            gender="MALE"
            placeholder="搜索父亲（按名字）"
            onPick={setFather}
          />
        )}
        {!clearFather && curFather && (
          <button
            onClick={() => {
              setClearFather(true);
              setFather(null);
            }}
            className="mt-1 text-[11px] text-red-600 hover:underline"
          >
            清除父亲关系
          </button>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs text-zinc-500">母亲</span>
          <span className="text-[11px] text-zinc-400">
            当前：{curMother?.name ?? "—"}
          </span>
        </div>
        {clearMother ? (
          <div className="flex items-center justify-between rounded-md bg-zinc-100 px-3 py-1.5 text-sm dark:bg-zinc-800">
            <span className="text-zinc-500">将清除母亲关系</span>
            <button
              onClick={() => setClearMother(false)}
              className="text-xs text-blue-600 hover:underline"
            >
              撤销
            </button>
          </div>
        ) : mother ? (
          <div className="flex items-center justify-between rounded-md bg-pink-50 px-3 py-1.5 text-sm dark:bg-pink-950">
            <span>{mother.name}（{mother.generation} 世）</span>
            <button
              onClick={() => setMother(null)}
              className="text-xs text-blue-600 hover:underline"
            >
              重选
            </button>
          </div>
        ) : (
          <PersonSearch
            familyId={familyId}
            gender="FEMALE"
            placeholder="搜索母亲（按名字）"
            onPick={setMother}
          />
        )}
        {!clearMother && curMother && (
          <button
            onClick={() => {
              setClearMother(true);
              setMother(null);
            }}
            className="mt-1 text-[11px] text-red-600 hover:underline"
          >
            清除母亲关系
          </button>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          取消
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          保存
        </button>
      </div>
    </div>
  );
}

function makeFakeRef(p: { id: string; name: string; gender: string }): SearchResult {
  return {
    id: p.id,
    name: p.name,
    alias: null,
    gender: p.gender as SearchResult["gender"],
    generation: 0,
    generationChar: null,
    isMarriedIn: false,
    status: "ALIVE",
  };
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex items-baseline gap-2">
      <span className="w-14 text-xs text-zinc-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}

function SmallNumberInput({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
}) {
  return (
    <label className="flex items-baseline gap-2">
      <span className="w-14 text-xs text-zinc-500">{label}</span>
      <input
        type="number"
        min={1}
        max={max}
        step={1}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onChange("");
            return;
          }
          const n = Number(v);
          if (Number.isFinite(n)) {
            const clamped = Math.min(Math.max(Math.round(n), 1), max);
            onChange(String(clamped));
          }
        }}
        className="w-16 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
      />
      <span className="text-[10px] text-zinc-400">≤ {max}</span>
    </label>
  );
}

function RadioRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-14 text-xs text-zinc-500">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${
                active
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200"
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

