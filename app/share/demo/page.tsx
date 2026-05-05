/**
 * /share/demo —— 公开演示家族
 *
 * 不依赖 ShareLink 表，直接读 seed 出的丁氏家族（surname = 丁）。
 * 这是给 landing 跳来的访客看的真实数据展示，必须比普通 share 页更有营销感。
 *
 * 与 /share/[token] 区分：Next.js 里 /share/demo/page.tsx 优先于 [token]/page.tsx。
 */
import Link from "next/link";

import { demoPrisma } from "@/lib/db";
import { layoutPaternalTree, TREE_LAYOUT_CONSTS } from "@/lib/services/tree-layout";
import {
  PaperBackdrop,
  PrimaryCTA,
  SealStamp,
  SecondaryCTA,
  SectionEyebrow,
  SectionTitle,
  Quote,
  Divider,
} from "@/components/marketing/elements";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/Footer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "丁氏家族 · 演示家族",
  description:
    "无需注册即可浏览的真实演示家族数据：6 个世代、字辈表、关系树、嫁入嫁出标识、迁徙路径——一次看完族谱·家的所有核心功能。",
};

export default async function DemoSharePage() {
  // ──── 1. 拉取 seed 出的丁氏家族 ────
  if (!demoPrisma) return <NotInitialized />;

  const family = await demoPrisma.family.findFirst({
    where: { surname: "丁", deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, surname: true, description: true },
  });

  if (!family) return <NotInitialized />;

  // ──── 2. 并发拉关联数据 ────
  const [
    persons,
    marriages,
    parentChild,
    generationNames,
    branches,
    migrations,
  ] = await Promise.all([
    demoPrisma.person.findMany({
      where: { familyId: family.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        alias: true,
        gender: true,
        generation: true,
        generationChar: true,
        birthOrder: true,
        birthYear: true,
        deathYear: true,
        isMarriedIn: true,
        status: true,
        biography: true,
      },
      orderBy: [{ generation: "asc" }, { birthOrder: "asc" }],
    }),
    demoPrisma.marriage.findMany({
      where: { familyId: family.id },
      select: { id: true, husbandId: true, wifeId: true, type: true, order: true },
    }),
    demoPrisma.parentChild.findMany({
      where: { familyId: family.id },
      select: { parentId: true, childId: true, birthOrder: true },
    }),
    demoPrisma.generationName.findMany({
      where: { familyId: family.id },
      orderBy: { generation: "asc" },
    }),
    demoPrisma.branch.findMany({
      where: { familyId: family.id },
      select: {
        id: true,
        name: true,
        rootPersonId: true,
        location: { select: { fullText: true } },
      },
    }),
    demoPrisma.migration.findMany({
      where: { familyId: family.id },
      orderBy: { year: "asc" },
      select: {
        id: true,
        year: true,
        reason: true,
        note: true,
        scope: true,
        fromLocation: { select: { fullText: true } },
        toLocation: { select: { fullText: true } },
      },
    }),
  ]);

  // ──── 3. 派生统计 ────
  const total = persons.length;
  const males = persons.filter((p) => p.gender === "MALE").length;
  const females = persons.filter((p) => p.gender === "FEMALE").length;
  const marriedIn = persons.filter((p) => p.isMarriedIn).length;
  const generations = Array.from(new Set(persons.map((p) => p.generation))).sort(
    (a, b) => a - b,
  );
  const minGen = generations[0];
  const maxGen = generations[generations.length - 1];
  const charByGen = new Map(generationNames.map((g) => [g.generation, g.character]));

  // 找根人物（最低 generation 且非嫁入的）
  const root =
    persons.find((p) => p.generation === minGen && !p.isMarriedIn) ?? persons[0];

  // ──── 4. 调用关系树布局 ────
  const layout = layoutPaternalTree({
    rootPersonId: root.id,
    persons: persons.map((p) => ({
      id: p.id,
      name: p.name,
      gender: p.gender,
      generation: p.generation,
      generationChar: p.generationChar,
      isMarriedIn: p.isMarriedIn,
      status: p.status,
      alias: p.alias,
      birthOrder: p.birthOrder,
    })),
    marriages: marriages.map((m) => ({
      id: m.id,
      husbandId: m.husbandId,
      wifeId: m.wifeId,
      type: m.type,
      order: m.order,
    })),
    parentChild: parentChild.map((pc) => ({
      parentId: pc.parentId,
      childId: pc.childId,
      birthOrder: pc.birthOrder,
    })),
  });

  // 节点 lookup（渲染连线时需要中心点）
  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));

  // ──── 5. 渲染 ────
  return (
    <PaperBackdrop>
      <MarketingNav />

      {/* ───── Hero ───── */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-10 sm:px-6 sm:pt-16 lg:px-8">
        <div className="rounded-2xl border border-rose-700/20 bg-[radial-gradient(80%_120%_at_30%_30%,rgba(168,32,31,0.08),transparent)] p-8 dark:border-rose-400/20 sm:p-12">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <SealStamp size="lg">{family.surname}</SealStamp>
              <div>
                <div className="text-xs font-medium tracking-[0.2em] text-rose-700 uppercase dark:text-rose-400">
                  演示家族 · 真实数据
                </div>
                <h1 className="mt-1 font-serif text-3xl font-semibold text-stone-900 dark:text-stone-50 sm:text-4xl">
                  {family.name}
                </h1>
                {family.description && (
                  <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">
                    {family.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <PrimaryCTA href="/register" variant="vermilion">
                给我家也建一份 →
              </PrimaryCTA>
              <SecondaryCTA href="/features">查看功能详解</SecondaryCTA>
            </div>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-6">
            <Stat label="在册人数" value={total} accent />
            <Stat label="世代" value={`${minGen}–${maxGen} 世`} />
            <Stat label="男" value={males} />
            <Stat label="女" value={females} />
            <Stat label="嫁入" value={marriedIn} />
            <Stat label="支系" value={branches.length} />
          </dl>

          <p className="mt-6 rounded-lg border border-rose-700/15 bg-white/70 px-4 py-3 text-xs leading-relaxed text-stone-700 dark:border-rose-400/15 dark:bg-stone-900/50 dark:text-stone-300">
            <strong className="text-rose-700 dark:text-rose-400">演示说明：</strong>{" "}
            这是 seed 时录入的真实家族数据片段（17 世–22 世训贤支）。所有数字、关系、迁徙、字辈完全来源于真实老谱。
            你看到的功能在登录后均可在你自己家族中使用。
          </p>
        </div>
      </section>

      {/* ───── 字辈表 ───── */}
      {generationNames.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <SectionEyebrow>字辈表</SectionEyebrow>
              <SectionTitle>每个字管一世，井然有序。</SectionTitle>
            </div>
            <span className="hidden text-xs text-stone-500 sm:block">
              点击右下角注册，即可在自己家族中维护字辈
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {generationNames.map((g) => {
              const count = persons.filter((p) => p.generation === g.generation).length;
              return (
                <div
                  key={g.id}
                  className="rounded-md border border-stone-200 bg-white/70 p-3 text-center dark:border-stone-800 dark:bg-stone-900/50"
                >
                  <div className="text-[10px] tracking-wider text-stone-500">
                    {g.generation} 世
                  </div>
                  <div className="mt-1 font-serif text-2xl font-semibold text-rose-700 dark:text-rose-400">
                    {g.character}
                  </div>
                  <div className="mt-1 text-[10px] text-stone-400">
                    {count > 0 ? `${count} 人` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ───── 关系树 ───── */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionEyebrow>关系树</SectionEyebrow>
            <SectionTitle>父系家谱布局，自动对齐字辈。</SectionTitle>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              妻子居左、丈夫居右；子女居中于父亲下方。
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                橙色标
              </span>{" "}
              表示嫁入家媳，
              <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[11px] text-stone-700 dark:bg-stone-700 dark:text-stone-300">
                灰色边
              </span>{" "}
              表示已故。同一世代横向对齐。
            </p>
          </div>
          <Link
            href="/features#tree"
            className="text-sm text-rose-700 hover:underline dark:text-rose-400"
          >
            完整树视图功能 →
          </Link>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-stone-50/80 p-6 dark:border-stone-800 dark:bg-stone-900/40">
          <FamilyTreeSvg layout={layout} nodeById={nodeById} />
        </div>
      </section>

      {/* ───── 迁徙时间线 ───── */}
      {migrations.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-6">
            <SectionEyebrow>迁徙史</SectionEyebrow>
            <SectionTitle>三百年里，一支族人去了哪里。</SectionTitle>
          </div>

          <ol className="relative space-y-5 border-l border-stone-200 pl-8 dark:border-stone-800">
            {migrations.map((m) => (
              <li key={m.id} className="relative">
                <span className="absolute -left-[33px] top-1.5 h-3 w-3 rounded-full bg-rose-700 ring-4 ring-stone-50 dark:bg-rose-400 dark:ring-stone-950" />
                <div className="rounded-xl border border-stone-200 bg-white/70 p-5 dark:border-stone-800 dark:bg-stone-900/50">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <strong className="font-serif text-lg text-stone-900 dark:text-stone-50">
                      {m.year ? `${m.year} 年` : "时间不详"}
                    </strong>
                    {m.reason && (
                      <span className="rounded-full bg-rose-700/10 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">
                        因 {m.reason}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
                    <span>{m.fromLocation?.fullText ?? "—"}</span>
                    <span className="text-rose-700 dark:text-rose-400">→</span>
                    <span>{m.toLocation?.fullText ?? "—"}</span>
                  </div>
                  {m.note && (
                    <p className="mt-2 text-xs leading-relaxed text-stone-500">
                      {m.note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ───── 人物卡片样例 ───── */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <SectionEyebrow>人物档案</SectionEyebrow>
          <SectionTitle>每位族人，都不止一个名字。</SectionTitle>
          <p className="mt-3 max-w-2xl text-sm text-stone-600 dark:text-stone-400">
            登录后可填写生卒、传记、迁徙、纸谱原文、字辈、配偶、子女、过继关系等数十个字段。下面是从演示家族中挑出的几个典型例子。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pickShowcase(persons, marriages).map((p) => (
            <PersonCard key={p.id} person={p} chars={charByGen} />
          ))}
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <Divider label="终" />
        <Quote source="《孝经·开宗明义》">
          身体发肤，受之父母；不敢毁伤，孝之始也。
        </Quote>
        <h2 className="mt-6 font-serif text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
          看完了演示，现在轮到你的家族。
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-stone-700 dark:text-stone-300">
          50 人以下永久免费 · 不绑卡 · 数据完全归你。先注册，邀请几位长辈，慢慢补谱。
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <PrimaryCTA href="/register" variant="vermilion">
            免费开始建谱 →
          </PrimaryCTA>
          <SecondaryCTA href="/pricing">查看价格</SecondaryCTA>
          <Link
            href="/features"
            className="text-sm text-stone-600 hover:text-rose-700 dark:text-stone-400 dark:hover:text-rose-400"
          >
            查看完整功能 →
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </PaperBackdrop>
  );
}

/* ─────────── 子组件 ─────────── */

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white/70 px-4 py-3 dark:border-stone-800 dark:bg-stone-900/50">
      <dt className="text-[11px] tracking-wider text-stone-500">{label}</dt>
      <dd
        className={`mt-1 font-serif text-2xl font-semibold tracking-tight ${
          accent
            ? "text-rose-700 dark:text-rose-400"
            : "text-stone-900 dark:text-stone-50"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function NotInitialized() {
  return (
    <PaperBackdrop>
      <MarketingNav />
      <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 py-20 text-center">
        <SealStamp size="lg">谱</SealStamp>
        <h1 className="mt-6 font-serif text-2xl font-semibold text-stone-900 dark:text-stone-50">
          演示数据正在准备中
        </h1>
        <p className="mt-3 max-w-md text-sm text-stone-600 dark:text-stone-400">
          演示家族尚未导入。开发者可以在仓库根目录运行{" "}
          <code className="rounded bg-stone-200 px-1.5 py-0.5 font-mono text-xs dark:bg-stone-800">
            pnpm db:seed
          </code>{" "}
          初始化丁氏 demo 数据。
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <PrimaryCTA href="/register" variant="vermilion">
            直接免费注册 →
          </PrimaryCTA>
          <SecondaryCTA href="/features">查看功能介绍</SecondaryCTA>
        </div>
      </section>
      <MarketingFooter />
    </PaperBackdrop>
  );
}

/* ─────────── 关系树 SVG ─────────── */

const { NODE_W, NODE_H } = TREE_LAYOUT_CONSTS;
const PADDING = 40;

type LayoutNode = ReturnType<typeof layoutPaternalTree>["nodes"][number];

function FamilyTreeSvg({
  layout,
  nodeById,
}: {
  layout: ReturnType<typeof layoutPaternalTree>;
  nodeById: Map<string, LayoutNode>;
}) {
  const width = layout.width + PADDING * 2;
  const height = layout.height + PADDING * 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      style={{ minWidth: width }}
      className="block max-w-none"
    >
      {/* 同辈基准线（淡色） */}
      {layout.generations.map((gen, i) => {
        const sample = layout.nodes.find((n) => n.person.generation === gen);
        if (!sample) return null;
        const y = sample.y + PADDING;
        return (
          <g key={gen}>
            <line
              x1={PADDING}
              y1={y + NODE_H / 2}
              x2={width - PADDING}
              y2={y + NODE_H / 2}
              stroke="#e7e5e4"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <text
              x={PADDING - 8}
              y={y + NODE_H / 2 + 3}
              textAnchor="end"
              className="fill-stone-400"
              fontFamily="serif"
              fontSize={11}
            >
              {gen} 世
              {i === 0 && "（始）"}
            </text>
          </g>
        );
      })}

      {/* 连线 */}
      {layout.edges
        .filter((e) => !e.hidden)
        .map((edge) => {
          const a = nodeById.get(edge.source);
          const b = nodeById.get(edge.target);
          if (!a || !b) return null;
          if (edge.kind === "marriage") {
            // 妻 → 夫，水平线
            const y = a.y + PADDING + NODE_H / 2;
            const x1 = a.x + PADDING + NODE_W;
            const x2 = b.x + PADDING;
            return (
              <line
                key={edge.id}
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke="#a8201f"
                strokeWidth={1.2}
              />
            );
          }
          // 父 → 子：竖-横-竖
          const px = a.x + PADDING + NODE_W / 2;
          const py = a.y + PADDING + NODE_H;
          const cx = b.x + PADDING + NODE_W / 2;
          const cy = b.y + PADDING;
          const midY = (py + cy) / 2;
          return (
            <path
              key={edge.id}
              d={`M ${px} ${py} L ${px} ${midY} L ${cx} ${midY} L ${cx} ${cy}`}
              stroke="#78716c"
              strokeWidth={1}
              fill="none"
            />
          );
        })}

      {/* 节点 */}
      {layout.nodes.map((n) => (
        <PersonNodeSvg key={n.id} n={n} />
      ))}
    </svg>
  );
}

function PersonNodeSvg({ n }: { n: LayoutNode }) {
  const x = n.x + PADDING;
  const y = n.y + PADDING;
  const isFemale = n.person.gender === "FEMALE";
  const isMarriedIn = n.person.isMarriedIn;
  const isDeceased = n.person.status === "DECEASED";

  const fill = isMarriedIn ? "#fef3c7" : isFemale ? "#fff" : "#fff";
  const stroke = isDeceased ? "#a8a29e" : isMarriedIn ? "#d97706" : "#1c1917";
  const textColor = isMarriedIn ? "#92400e" : isDeceased ? "#78716c" : "#1c1917";

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={4}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.2}
        strokeDasharray={isDeceased ? "4 3" : ""}
      />
      {/* 字辈角标（顶部小字） */}
      {n.person.generationChar && (
        <text
          x={NODE_W / 2}
          y={12}
          textAnchor="middle"
          fill="#a8a29e"
          fontFamily="serif"
          fontSize={9}
        >
          {n.person.generation}世·{n.person.generationChar}
        </text>
      )}
      {/* 竖排姓名 */}
      <text
        x={NODE_W / 2}
        y={NODE_H / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textColor}
        fontFamily="serif"
        fontSize={n.person.name.length > 2 ? 14 : 16}
        fontWeight={isMarriedIn ? 500 : 600}
        style={{ writingMode: "vertical-rl" } as React.CSSProperties}
      >
        {n.person.name}
      </text>
      {/* 嫁入标签 */}
      {isMarriedIn && (
        <text
          x={NODE_W / 2}
          y={NODE_H - 6}
          textAnchor="middle"
          fill="#d97706"
          fontFamily="serif"
          fontSize={9}
        >
          嫁入
        </text>
      )}
    </g>
  );
}

/* ─────────── 人物卡 ─────────── */

type PersonRow = {
  id: string;
  name: string;
  alias: string | null;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  generation: number;
  generationChar: string | null;
  birthYear: number | null;
  deathYear: number | null;
  isMarriedIn: boolean;
  status: string;
  biography: string | null;
};

type MarriageRow = {
  husbandId: string;
  wifeId: string;
  type: string;
};

/**
 * 从全族人物里挑代表性 6 位：优先选有传记/生卒的，覆盖各种状态（在世/已故/嫁入）。
 */
function pickShowcase(persons: PersonRow[], marriages: MarriageRow[]): PersonRow[] {
  const picks: PersonRow[] = [];
  const seen = new Set<string>();

  const push = (p: PersonRow | undefined) => {
    if (p && !seen.has(p.id)) {
      picks.push(p);
      seen.add(p.id);
    }
  };

  // 1. 有传记的（按世代升序）
  const withBio = persons.filter((p) => p.biography).sort(
    (a, b) => a.generation - b.generation,
  );
  for (const p of withBio) {
    push(p);
    if (picks.length >= 4) break;
  }

  // 2. 一位嫁入的（继配优先，更具戏剧性）
  const husbandsWithSecondary = new Set<string>();
  for (const m of marriages) {
    if (m.type === "SECONDARY") husbandsWithSecondary.add(m.husbandId);
  }
  push(
    persons.find(
      (p) => p.isMarriedIn && p.name.length >= 2 && !p.biography,
    ),
  );

  // 3. 一位最年幼的（最高世代）
  const maxGen = Math.max(...persons.map((p) => p.generation));
  push(persons.find((p) => p.generation === maxGen && !p.isMarriedIn));

  // 4. 一位中世代有子女的男性
  const minGen = Math.min(...persons.map((p) => p.generation));
  push(
    persons.find(
      (p) => p.gender === "MALE" && !p.isMarriedIn && p.generation === minGen + 2,
    ),
  );

  return picks.slice(0, 6);
}

function PersonCard({
  person,
  chars,
}: {
  person: PersonRow;
  chars: Map<number, string>;
}) {
  const tags: { label: string; tone: "rose" | "amber" | "stone" | "emerald" }[] = [];
  if (person.isMarriedIn) tags.push({ label: "嫁入", tone: "amber" });
  if (person.status === "DECEASED") tags.push({ label: "已故", tone: "stone" });
  if (person.status === "ALIVE") tags.push({ label: "在世", tone: "emerald" });
  if (chars.get(person.generation))
    tags.push({
      label: `${person.generation} 世·${chars.get(person.generation)}字辈`,
      tone: "rose",
    });

  return (
    <div className="flex flex-col rounded-xl border border-stone-200 bg-white/70 p-5 dark:border-stone-800 dark:bg-stone-900/50">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h3 className="font-serif text-xl font-semibold text-stone-900 dark:text-stone-50">
            {person.name}
          </h3>
          {person.alias && (
            <span className="text-xs text-stone-400">字 {person.alias}</span>
          )}
        </div>
        <span className="text-[10px] text-stone-400">
          {person.gender === "FEMALE" ? "♀" : person.gender === "MALE" ? "♂" : "·"}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
        {tags.map((t) => (
          <span
            key={t.label}
            className={`rounded-full px-1.5 py-0.5 font-medium ${
              t.tone === "rose"
                ? "bg-rose-700/15 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300"
                : t.tone === "amber"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  : t.tone === "emerald"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300"
            }`}
          >
            {t.label}
          </span>
        ))}
      </div>

      {(person.birthYear || person.deathYear) && (
        <p className="mt-3 text-sm text-stone-600 dark:text-stone-400">
          {person.birthYear ?? "?"}
          {" – "}
          {person.deathYear ?? (person.status === "ALIVE" ? "今" : "?")}
        </p>
      )}

      {person.biography ? (
        <p className="mt-3 flex-1 border-l-2 border-rose-700/30 pl-3 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
          {person.biography}
        </p>
      ) : (
        <p className="mt-3 flex-1 text-xs leading-relaxed text-stone-500">
          登录后可继续填写：生卒、字号、传记、迁徙、纸谱原文、过继关系等数十个字段。
        </p>
      )}
    </div>
  );
}
