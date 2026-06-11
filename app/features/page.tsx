/**
 * /features —— 功能详解
 *
 * 每一项功能：图示 + 文案 + 适用场景。
 */
import Link from "next/link";

import {
  Divider,
  PaperBackdrop,
  PrimaryCTA,
  SealStamp,
  SecondaryCTA,
  SectionEyebrow,
} from "@/components/marketing/elements";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/Footer";

export const dynamic = "force-static";

export const metadata = {
  title: "功能详解 · 族谱·家",
  description: "关系树、吊线古谱、字辈支系、居住地继承、子树管理员、册谱 PDF、Excel 导入、GEDCOM 导出。每一项都来自真实的修谱场景。",
};

const ANCHORS = [
  { id: "tree", label: "关系树" },
  { id: "lineage", label: "吊线古谱" },
  { id: "generation", label: "字辈与支系" },
  { id: "residence", label: "居住地继承" },
  { id: "permissions", label: "权限与审计" },
  { id: "invite", label: "邀请系统" },
  { id: "import", label: "Excel 导入" },
  { id: "export", label: "导出与所有权" },
  { id: "stats", label: "家族统计" },
  { id: "share", label: "私密分享" },
];

export default function FeaturesPage() {
  return (
    <PaperBackdrop>
      <MarketingNav active="/features" />

      {/* ───── 标题 ───── */}
      <section className="mx-auto max-w-5xl px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto mb-5 inline-flex">
          <SealStamp size="md">谱</SealStamp>
        </div>
        <SectionEyebrow>
          <span className="mx-auto">功能详解</span>
        </SectionEyebrow>
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-5xl">
          每一项，都来自真实的修谱场景。
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-stone-700 dark:text-stone-300">
          我们没有照抄国外 GEDCOM 工具——中国家谱有自己独特的逻辑：字辈、支系、嫁入嫁出、居住地继承、子树授权。
          下面是我们已落地的每项核心功能。
        </p>

        {/* 锚点导航 */}
        <nav className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2 text-xs">
          {ANCHORS.map((a) => (
            <a
              key={a.id}
              href={`#${a.id}`}
              className="rounded-full border border-stone-300 bg-white/60 px-3 py-1.5 text-stone-700 transition hover:border-rose-700 hover:text-rose-700 dark:border-stone-700 dark:bg-stone-900/40 dark:text-stone-300 dark:hover:border-rose-400 dark:hover:text-rose-400"
            >
              {a.label}
            </a>
          ))}
        </nav>
      </section>

      {/* ───── 功能详解 ───── */}
      <FeatureSection
        id="tree"
        index="01"
        title="关系树"
        subtitle="父母 / 配偶 / 子女三向滑动，一个手势走完五代。"
        body={[
          "为现代设备而生：手机上一只手就能完成探查祖先、平辈与子嗣三向跳转。",
          "节点支持折叠 / 展开，避免大族打开就是一锅粥；折叠角标显示后代数量。",
          "Inspector 抽屉随选随显，长辈名讳、字辈、生卒、居住地一目了然。",
        ]}
        scenarios={[
          "长辈想找曾祖父的弟弟那一支：点击祖父→兄弟→子孙。",
          "在春节家宴上现场认人：扫码进谱，长按头像看辈分。",
          "整族 5,000 人，要快速跳到自己直系父母线：折叠 + 路径高亮。",
        ]}
        visual={<TreeVisual />}
      />

      <FeatureSection
        id="lineage"
        index="02"
        title="吊线古谱"
        subtitle="千年传统的吊线图排版，同辈对齐、嫁入红字、嫁出虚线，一键打印整族。"
        flipped
        body={[
          "完全按中国宗谱的样式排版：横线表世代、竖线表父子、姓名竖排。",
          "嫁入家媳家族用朱红字，嫁出女用虚线，红黑分明，对得起祖宗的规矩。",
          "支持按支系拆分页或合并整族打印；A3 / A2 大幅面 PDF 一键出。",
        ]}
        scenarios={[
          "续修家谱时印一份给长辈过目：直接 PDF 打印交付。",
          "祭祖时投影于祠堂大屏：吊线图按支系展开，一目清晰。",
          "向家中长辈赠送实体书：经增值服务装订成线装册。",
        ]}
        visual={<LineageVisual />}
      />

      <FeatureSection
        id="generation"
        index="03"
        title="字辈与支系"
        subtitle="同 N 世自动对齐，多支系并排，长支幼支井然有序。"
        body={[
          "字辈表（行第表）独立维护：「国正天心顺，官清民自安」每个字对应一世。",
          "支系树独立于关系树存在——可以一族多支系，每支系内部自有族长。",
          "添加新人时按字辈自动建议名字第二个字（如第 16 世建议「天」字）。",
        ]}
        scenarios={[
          "重修家谱续字辈：在原字辈表基础上续 20 个字，全族下一代自动按新字辈命名。",
          "三个支系合修：每支系有自己的族长，但同辈自动对齐。",
          "祭祖按辈分排序：自动按字辈顺序排座次。",
        ]}
        visual={<GenerationVisual />}
        flipped
      />

      <FeatureSection
        id="residence"
        index="04"
        title="居住地继承"
        subtitle="迁徙路径自动追溯——'江西 → 湖广 → 四川'三百年迁徙线一目了然。"
        body={[
          "未填居住地的人，自动继承父辈最近的居住地，避免每个人都手填。",
          "迁徙路径自动绘制：哪一代从哪迁到哪，自动显示在家族迁徙地图上。",
          "支持「祖籍 + 现居住」两套字段，祖籍永远跟着这一支不变。",
        ]}
        scenarios={[
          "祖父辈从湖广填四川，至今家中「祖籍湖广」——系统自动追溯到最早的迁出点。",
          "想知道哪些族人已经迁到海外：迁徙地图按国家分色。",
          "续谱时新生儿不必再填居住地，自动继承父亲。",
        ]}
        visual={<ResidenceVisual />}
      />

      <FeatureSection
        id="permissions"
        index="05"
        title="多角色权限 + 审计日志"
        subtitle="谁改了谁、何时改、改了什么，全部可回溯，避免误删长辈。"
        body={[
          "四级角色：族长 / 管理员 / 成员 / 访客；族长可指定多个管理员协作。",
          "子树管理员：把某一支授权给分支代表；他只能改自己一支，主谱安全。",
          "审计日志记录每一次写操作：before / after / 操作人 / 时间，永久可追溯（永久珍藏版）。",
        ]}
        scenarios={[
          "远房叔叔误删了一支祖辈：族长一键回滚。",
          "分支远迁外地，族长把那一支授权给分支代表自管。",
          "修谱争议：调审计日志看谁改了谁。",
        ]}
        visual={<PermissionsVisual />}
        flipped
      />

      <FeatureSection
        id="invite"
        index="06"
        title="邀请系统"
        subtitle="生成 8 位邀请码或扫码海报，族人扫一扫即加入对应支系。"
        body={[
          "邀请码：8 位字母数字，可指定有效期、可指定加入后角色（成员 / 访客）。",
          "邀请链接 + 二维码海报：一键生成春节祭祖海报，含家族名 / 二维码 / 字辈口诀。",
          "可针对某一支系发邀请：扫码加入即自动归到该支系下。",
        ]}
        scenarios={[
          "春节家族群里发二维码：扫一扫认祖归宗。",
          "分支单独建群：发邀请码限定加入到该支系。",
          "长辈不会用：直接用 8 位邀请码 + 手机号即可加入。",
        ]}
        visual={<InviteVisual />}
      />

      <FeatureSection
        id="import"
        index="07"
        title="Excel 批量导入"
        subtitle="把家中那份十几年前的 Excel 老底册整批迁过来，自动校验关系一致性。"
        body={[
          "支持自定义列映射：你的 Excel 列名是什么没关系，导入时自由对齐。",
          "导入前 Dry-Run：先看预期会发生什么变化（新增 / 更新 / 冲突），再真正提交。",
          "关系一致性校验：父母关系闭环检测、字辈与世代一致性校验，错的当场报。",
        ]}
        scenarios={[
          "上一代修谱用 Excel 维护了十几年：一键迁入新平台。",
          "三家分别有 Excel：分别导入再合并审核。",
          "村委会有人口名册：批量导入再和族中老人核对。",
        ]}
        visual={<ImportVisual />}
        flipped
      />

      <FeatureSection
        id="export"
        index="08"
        title="导出与数据所有权"
        subtitle="JSON / CSV / GEDCOM 三种格式，数据归你；可导入海外家谱平台。"
        body={[
          "JSON：完整保留我们的中文字段（字辈、支系、嫁入嫁出等）。",
          "CSV：电子表格用，方便长辈在 Excel 里二次核对。",
          "GEDCOM 5.5.1：国际通用，可导入 Ancestry / FamilySearch / 各类海外家谱工具。",
        ]}
        scenarios={[
          "不想被锁定：随时一键导出 JSON 备份到自家电脑。",
          "海外亲戚用 Ancestry：导出 GEDCOM 给他们继续维护海外支系。",
          "宗祠存档要求物理副本：导出 PDF + JSON 一并刻录光盘。",
        ]}
        visual={<ExportVisual />}
      />

      <FeatureSection
        id="stats"
        index="09"
        title="家族统计"
        subtitle="寿命分布、男女比、迁徙地图、世代繁衍曲线——做家训分析的底料。"
        body={[
          "寿命分布：哪一代寿星最多？是不是某个生活习惯改变后寿命下降？",
          "迁徙地图：按朝代 / 世代分层显示家族迁徙路径。",
          "世代繁衍：哪一代人口最多？哪一代缩水了？背后的历史可以追溯到大事件。",
        ]}
        scenarios={[
          "重阳节族会上分享族中寿星 Top 10。",
          "想找回失散一支：看迁徙地图圈定可能的现居地。",
          "学者做家族史研究：用统计图表写文章。",
        ]}
        visual={<StatsVisual />}
        flipped
      />

      <FeatureSection
        id="share"
        index="10"
        title="私密分享"
        subtitle="按支系生成临时分享链接 / 二维码海报，过期自动失效。"
        body={[
          "分享链接：可设有效期 / 可设密码 / 可限制可见字段（隐私敏感字段可隐藏）。",
          "扫码海报：节日定制版（春节红 / 清明青 / 重阳黄），扫码进谱第几世。",
          "默认私密：未授权不可访问。族谱不是社交内容，权限边界严格。",
        ]}
        scenarios={[
          "亲戚要看谱但不想加入：发临时链接，3 天后失效。",
          "村祠堂要展示一份对外谱：把生卒详情等隐私字段隐去后分享。",
          "微信群拉新：扫码海报，扫一扫看自己在第几世。",
        ]}
        visual={<ShareVisual />}
      />

      {/* ───── 终极 CTA ───── */}
      <section className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <Divider label="始" />
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
          先从五十人开始，五年后是五千。
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-stone-700 dark:text-stone-300">
          每一本完整的家谱，都是从一行字、一个名字、一段记忆开始的。今天种树，子孙乘凉。
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <PrimaryCTA href="/register" variant="vermilion">
            免费开始建谱 →
          </PrimaryCTA>
          <SecondaryCTA href="/pricing">查看价格</SecondaryCTA>
          <Link
            href="/about"
            className="text-sm text-stone-600 hover:text-rose-700 dark:text-stone-400 dark:hover:text-rose-400"
          >
            了解我们的故事 →
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </PaperBackdrop>
  );
}

/* ─────────── 通用功能区块 ─────────── */

function FeatureSection({
  id,
  index,
  title,
  subtitle,
  body,
  scenarios,
  visual,
  flipped,
}: {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  body: string[];
  scenarios: string[];
  visual: React.ReactNode;
  flipped?: boolean;
}) {
  return (
    <section
      id={id}
      className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8"
    >
      <div
        className={`grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16 ${
          flipped ? "lg:[&>:first-child]:order-2" : ""
        }`}
      >
        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="font-serif text-2xl font-light tracking-widest text-rose-700/80 dark:text-rose-400/80">
              {index}
            </span>
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
          </div>
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
            {title}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-stone-700 dark:text-stone-300">
            {subtitle}
          </p>

          <ul className="mt-6 space-y-2 text-sm text-stone-700 dark:text-stone-300">
            {body.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-700 dark:bg-rose-400" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 rounded-xl border border-stone-200 bg-stone-50/60 p-5 dark:border-stone-800 dark:bg-stone-900/40">
            <div className="mb-2 text-xs font-medium tracking-wider text-stone-500 uppercase">
              典型场景
            </div>
            <ul className="space-y-1.5 text-sm text-stone-700 dark:text-stone-300">
              {scenarios.map((s, i) => (
                <li key={i}>· {s}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-stone-100/60 p-6 dark:border-stone-800 dark:bg-stone-900/40">
          <div className="aspect-[4/3]">{visual}</div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── 视觉示意 ─────────── */

function TreeVisual() {
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full">
      <g stroke="#d6d3d1" strokeWidth="1.5" fill="none">
        <path d="M200 50 V 100" />
        <path d="M120 100 H 280" />
        <path d="M120 100 V 130" />
        <path d="M200 100 V 130" />
        <path d="M280 100 V 130" />
        <path d="M120 180 V 220" />
        <path d="M280 180 V 220" />
      </g>
      <NodeBox x={200} y={30} w={120} h={40} title="王元正" sub="14 世" main />
      <NodeBox x={120} y={150} w={100} h={36} title="王国华" sub="15 世" />
      <NodeBox x={200} y={150} w={100} h={36} title="王国梁" sub="15 世" />
      <NodeBox x={280} y={150} w={100} h={36} title="王素芳" sub="嫁出" muted />
      <NodeBox x={120} y={240} w={84} h={32} title="王天明" sub="16 世" small />
      <NodeBox x={280} y={240} w={84} h={32} title="王天宇" sub="16 世" small />
    </svg>
  );
}

function NodeBox({
  x,
  y,
  w,
  h,
  title,
  sub,
  main,
  small,
  muted,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  main?: boolean;
  small?: boolean;
  muted?: boolean;
}) {
  return (
    <g transform={`translate(${x - w / 2}, ${y})`}>
      <rect
        width={w}
        height={h}
        rx={6}
        fill={main ? "#a8201f" : muted ? "#e7e5e4" : "#fff"}
        stroke={main ? "#a8201f" : "#d6d3d1"}
        strokeWidth="1"
      />
      <text
        x={w / 2}
        y={small ? 14 : 18}
        textAnchor="middle"
        fill={main ? "#fff7ed" : muted ? "#78716c" : "#1c1917"}
        fontFamily="serif"
        fontSize={main ? 14 : small ? 11 : 12}
        fontWeight={600}
      >
        {title}
      </text>
      <text
        x={w / 2}
        y={small ? 26 : 32}
        textAnchor="middle"
        fill={main ? "rgba(255,247,237,0.7)" : "#a8a29e"}
        fontSize={small ? 8 : 10}
      >
        {sub}
      </text>
    </g>
  );
}

function LineageVisual() {
  const cols = ["元正", "元盛", "元昌", "元明", "元达"];
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full">
      <line x1="20" y1="50" x2="380" y2="50" stroke="#1c1917" strokeWidth="2" />
      <line x1="20" y1="220" x2="380" y2="220" stroke="#1c1917" strokeWidth="2" />
      <text x="200" y="32" textAnchor="middle" fill="#57534e" fontFamily="serif" fontSize="14">
        第十五世 · 元字辈
      </text>

      {cols.map((n, i) => {
        const x = 60 + i * 70;
        const isMarry = i === 4;
        return (
          <g key={i}>
            <line x1={x} y1="50" x2={x} y2="90" stroke="#1c1917" strokeWidth="1.2" />
            <rect
              x={x - 24}
              y="90"
              width="48"
              height="70"
              fill="#fbf7ee"
              stroke="#1c1917"
              strokeWidth="1.2"
            />
            <text
              x={x}
              y="125"
              textAnchor="middle"
              fill={isMarry ? "#a8201f" : "#1c1917"}
              fontFamily="serif"
              fontSize="16"
              fontWeight={500}
              style={{ writingMode: "vertical-rl" } as React.CSSProperties}
            >
              {n}
            </text>
            <line
              x1={x}
              y1="160"
              x2={x}
              y2="220"
              stroke="#1c1917"
              strokeWidth="1.2"
              strokeDasharray={isMarry ? "4 3" : ""}
            />
          </g>
        );
      })}

      <text x="200" y="255" textAnchor="middle" fill="#78716c" fontFamily="serif" fontSize="11">
        ※ 红字为嫁入 · 虚线为嫁出 / 失传
      </text>
    </svg>
  );
}

function GenerationVisual() {
  const chars = ["国", "正", "天", "心", "顺", "官", "清", "民"];
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full">
      <text x="200" y="35" textAnchor="middle" fill="#57534e" fontFamily="serif" fontSize="14" fontWeight={600}>
        家族字辈表（行第）
      </text>
      {chars.map((c, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 70 + col * 80;
        const y = 70 + row * 90;
        return (
          <g key={i}>
            <rect x={x - 28} y={y - 28} width="56" height="56" rx="4" fill="#fbf7ee" stroke="#a8201f" strokeWidth="1.2" />
            <text x={x} y={y + 8} textAnchor="middle" fill="#a8201f" fontFamily="serif" fontSize="22" fontWeight={600}>
              {c}
            </text>
            <text x={x} y={y + 24} textAnchor="middle" fill="#78716c" fontSize="9">
              {12 + i} 世
            </text>
          </g>
        );
      })}
      <text x="200" y="260" textAnchor="middle" fill="#78716c" fontFamily="serif" fontSize="11">
        国正天心顺，官清民自安
      </text>
    </svg>
  );
}

function ResidenceVisual() {
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full">
      <rect width="400" height="280" rx="8" fill="#fbf7ee" />
      {/* 假地图轮廓 */}
      <path
        d="M50 100 Q 100 80 160 90 T 280 100 T 360 130 L 360 200 Q 280 220 200 210 T 60 220 Z"
        fill="#e7e5e4"
        stroke="#a8a29e"
        strokeWidth="1"
      />
      {/* 迁徙路径 */}
      <path
        d="M90 120 Q 140 145 200 160 T 320 175"
        stroke="#a8201f"
        strokeWidth="2"
        strokeDasharray="6 4"
        fill="none"
        markerEnd="url(#arrow)"
      />
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill="#a8201f" />
        </marker>
      </defs>
      {/* 三个站点 */}
      <Place x={90} y={120} label="江西" sub="12 世前" />
      <Place x={200} y={160} label="湖广" sub="13–15 世" />
      <Place x={310} y={175} label="四川" sub="16 世至今" />
      <text x="200" y="40" textAnchor="middle" fill="#57534e" fontFamily="serif" fontSize="14" fontWeight={600}>
        家族迁徙路径
      </text>
    </svg>
  );
}

function Place({ x, y, label, sub }: { x: number; y: number; label: string; sub: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="6" fill="#a8201f" stroke="#fff" strokeWidth="2" />
      <text x={x} y={y - 12} textAnchor="middle" fill="#1c1917" fontFamily="serif" fontSize="12" fontWeight={600}>
        {label}
      </text>
      <text x={x} y={y + 22} textAnchor="middle" fill="#78716c" fontSize="9">
        {sub}
      </text>
    </g>
  );
}

function PermissionsVisual() {
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full">
      <rect width="400" height="280" rx="8" fill="#fbf7ee" />
      <Pill x={90} y={50} w={140} label="族长" sub="王老" tone="primary" />
      <Pill x={110} y={110} w={100} label="管理员 ×3" tone="ink" />
      <Pill x={250} y={110} w={120} label="子树管理员" sub="王二支代表" tone="emerald" />
      <Pill x={130} y={170} w={140} label="成员 1,200+" tone="muted" />
      <Pill x={250} y={170} w={120} label="访客" tone="muted" />

      <line x1="160" y1="78" x2="160" y2="92" stroke="#a8a29e" strokeWidth="1" />
      <line x1="160" y1="78" x2="310" y2="92" stroke="#a8a29e" strokeWidth="1" />
      <line x1="160" y1="138" x2="200" y2="152" stroke="#a8a29e" strokeWidth="1" />
      <line x1="310" y1="138" x2="310" y2="152" stroke="#0d9488" strokeWidth="1.5" />

      <text x="200" y="240" textAnchor="middle" fill="#57534e" fontFamily="serif" fontSize="13" fontWeight={500}>
        族长授权 · 子树管理员只能改自己一支
      </text>
      <text x="200" y="258" textAnchor="middle" fill="#78716c" fontSize="10">
        审计日志全程记录每次写入
      </text>
    </svg>
  );
}

function Pill({
  x,
  y,
  w,
  label,
  sub,
  tone,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  sub?: string;
  tone: "primary" | "ink" | "emerald" | "muted";
}) {
  const colors = {
    primary: { bg: "#a8201f", fg: "#fff7ed" },
    ink: { bg: "#1c1917", fg: "#fafaf9" },
    emerald: { bg: "#0d9488", fg: "#ecfdf5" },
    muted: { bg: "#e7e5e4", fg: "#44403c" },
  }[tone];
  const h = sub ? 38 : 28;
  return (
    <g transform={`translate(${x}, ${y - h / 2})`}>
      <rect width={w} height={h} rx={h / 2} fill={colors.bg} />
      <text x={w / 2} y={sub ? 16 : 18} textAnchor="middle" fill={colors.fg} fontFamily="serif" fontSize="12" fontWeight={600}>
        {label}
      </text>
      {sub && (
        <text x={w / 2} y={30} textAnchor="middle" fill={colors.fg} fontSize="9" opacity="0.7">
          {sub}
        </text>
      )}
    </g>
  );
}

function InviteVisual() {
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full">
      <rect width="400" height="280" rx="8" fill="#fbf7ee" />
      <rect x="120" y="30" width="160" height="220" rx="8" fill="#a8201f" />
      <text x="200" y="60" textAnchor="middle" fill="#fff7ed" fontFamily="serif" fontSize="14" fontWeight={600}>
        王氏宗谱
      </text>
      <text x="200" y="80" textAnchor="middle" fill="#fff7ed" opacity="0.8" fontFamily="serif" fontSize="10">
        丙寅年 · 春节合谱
      </text>
      {/* 假二维码 */}
      <g transform="translate(150 95)">
        {Array.from({ length: 11 }).map((_, r) =>
          Array.from({ length: 11 }).map((_, c) => {
            const isOn = (r * 7 + c * 13 + r * c) % 3 === 0;
            return isOn ? (
              <rect key={`${r}-${c}`} x={c * 9} y={r * 9} width="8" height="8" fill="#fff7ed" />
            ) : null;
          })
        )}
      </g>
      <text x="200" y="220" textAnchor="middle" fill="#fff7ed" fontFamily="monospace" fontSize="14" letterSpacing="3">
        WANG-2024
      </text>
      <text x="200" y="240" textAnchor="middle" fill="#fff7ed" opacity="0.6" fontFamily="serif" fontSize="10">
        扫码 / 输入码 加入家族
      </text>
    </svg>
  );
}

function ImportVisual() {
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full">
      <rect width="400" height="280" rx="8" fill="#fbf7ee" />
      <rect x="30" y="40" width="150" height="200" rx="6" fill="#fff" stroke="#a8a29e" />
      <text x="105" y="60" textAnchor="middle" fill="#1c1917" fontFamily="monospace" fontSize="11" fontWeight={600}>
        家族.xlsx
      </text>
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={42} y={75 + i * 22} width="126" height="14" rx="2" fill={i === 0 ? "#fef3c7" : "#f5f5f4"} />
      ))}

      <path d="M195 140 L 235 140 M 230 130 L 245 140 L 230 150" stroke="#a8201f" strokeWidth="2" fill="none" />

      <rect x="245" y="40" width="125" height="200" rx="6" fill="#fff" stroke="#a8a29e" />
      <text x="307" y="60" textAnchor="middle" fill="#1c1917" fontFamily="serif" fontSize="11" fontWeight={600}>
        预览导入
      </text>
      <text x="260" y="85" fill="#0d9488" fontSize="10">+ 12 新增</text>
      <text x="260" y="100" fill="#3b82f6" fontSize="10">~ 3 更新</text>
      <text x="260" y="115" fill="#a8201f" fontSize="10">! 1 冲突</text>
      <text x="260" y="135" fill="#78716c" fontSize="9">王元正 / 父辈错</text>
      <text x="260" y="170" fill="#1c1917" fontSize="10" fontFamily="serif" fontWeight={600}>Dry-Run 模式</text>
      <text x="260" y="185" fill="#78716c" fontSize="9">先看再提交</text>
    </svg>
  );
}

function ExportVisual() {
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full">
      <rect width="400" height="280" rx="8" fill="#fbf7ee" />
      {[
        { x: 50, label: "JSON", sub: "完整保留中文字段", color: "#a8201f" },
        { x: 160, label: "CSV", sub: "Excel 二次核对", color: "#c9a85c" },
        { x: 270, label: "GEDCOM", sub: "国际通用", color: "#0d9488" },
      ].map((f, i) => (
        <g key={i}>
          <rect x={f.x} y="70" width="80" height="100" rx="6" fill={f.color} />
          <text x={f.x + 40} y="115" textAnchor="middle" fill="#fff7ed" fontFamily="serif" fontSize="14" fontWeight={700}>
            {f.label}
          </text>
          <text x={f.x + 40} y="195" textAnchor="middle" fill="#57534e" fontSize="10">
            {f.sub}
          </text>
        </g>
      ))}
      <text x="200" y="40" textAnchor="middle" fill="#1c1917" fontFamily="serif" fontSize="14" fontWeight={600}>
        随时导出 · 数据完全归你
      </text>
      <text x="200" y="245" textAnchor="middle" fill="#78716c" fontSize="11">
        永久珍藏版含原始数据库导出 + 私有部署支持
      </text>
    </svg>
  );
}

function StatsVisual() {
  const ages = [18, 32, 48, 56, 42, 28, 14];
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full">
      <rect width="400" height="280" rx="8" fill="#fbf7ee" />
      <text x="40" y="40" fill="#1c1917" fontFamily="serif" fontSize="14" fontWeight={600}>
        寿命分布
      </text>
      <text x="40" y="56" fill="#78716c" fontSize="10">第 12–18 世</text>

      {ages.map((v, i) => (
        <g key={i}>
          <rect
            x={50 + i * 45}
            y={240 - v * 3}
            width="32"
            height={v * 3}
            rx="2"
            fill={`url(#statsGrad)`}
          />
          <text
            x={50 + i * 45 + 16}
            y="256"
            textAnchor="middle"
            fill="#78716c"
            fontSize="9"
          >
            {12 + i}
          </text>
        </g>
      ))}

      <defs>
        <linearGradient id="statsGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#c9a85c" />
          <stop offset="1" stopColor="#a8201f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ShareVisual() {
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full">
      <rect width="400" height="280" rx="8" fill="#fbf7ee" />
      <rect x="80" y="30" width="240" height="50" rx="6" fill="#fff" stroke="#a8a29e" />
      <text x="100" y="60" fill="#1c1917" fontFamily="monospace" fontSize="11">
        zupu.app/share/8KX2NF...
      </text>
      <text x="270" y="60" fill="#a8201f" fontFamily="serif" fontSize="11" fontWeight={600}>
        3 天后失效
      </text>

      <rect x="80" y="100" width="115" height="80" rx="6" fill="#a8201f" />
      <text x="137" y="135" textAnchor="middle" fill="#fff7ed" fontSize="32">
        春
      </text>
      <text x="137" y="160" textAnchor="middle" fill="#fff7ed" fontFamily="serif" fontSize="10">
        春节祭祖
      </text>

      <rect x="205" y="100" width="115" height="80" rx="6" fill="#0d9488" />
      <text x="262" y="135" textAnchor="middle" fill="#ecfdf5" fontSize="32">
        清
      </text>
      <text x="262" y="160" textAnchor="middle" fill="#ecfdf5" fontFamily="serif" fontSize="10">
        清明扫墓
      </text>

      <text x="200" y="220" textAnchor="middle" fill="#1c1917" fontFamily="serif" fontSize="13" fontWeight={500}>
        节日定制二维码海报
      </text>
      <text x="200" y="240" textAnchor="middle" fill="#78716c" fontSize="10">
        扫一扫看自己在第几世
      </text>
    </svg>
  );
}
