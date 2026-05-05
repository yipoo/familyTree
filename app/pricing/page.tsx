/**
 * /pricing —— 详细价格对照
 *
 * 结构：
 *   1. 标题
 *   2. 四档定价卡（免费 / 家族 / 宗祠 / 永久珍藏）
 *   3. 完整对照表
 *   4. 增值服务
 *   5. FAQ
 *   6. 联系 / 团购
 */
import Link from "next/link";

import {
  Divider,
  PaperBackdrop,
  PrimaryCTA,
  Quote,
  SealStamp,
  SecondaryCTA,
  SectionEyebrow,
  SectionTitle,
} from "@/components/marketing/elements";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/Footer";

export const dynamic = "force-static";

export const metadata = {
  title: "价格 · 族谱·家",
  description: "免费版 / 家族版 ¥98 / 宗祠版 ¥298 / 永久珍藏 ¥1,980。50 人以下永久免费，规模更大再升级。",
};

export default function PricingPage() {
  return (
    <PaperBackdrop>
      <MarketingNav active="/pricing" />

      {/* ───────── 标题区 ───────── */}
      <section className="mx-auto max-w-5xl px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto mb-5 inline-flex">
          <SealStamp size="md">谱</SealStamp>
        </div>
        <SectionEyebrow>
          <span className="mx-auto">透明定价</span>
        </SectionEyebrow>
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-5xl">
          一份家谱，配得上一份庄重的承诺。
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-stone-700 dark:text-stone-300">
          50 人以下家族永久免费。<br />
          规模更大、修谱认真，再考虑付费版本。任何时候你的数据都可以一键导出，没有锁定。
        </p>
      </section>

      {/* ───────── 价格卡 ───────── */}
      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-4">
          <PriceCard
            name="免费版"
            description="给刚开始想修谱的小家庭"
            price="¥0"
            unit="永久"
            cta={{ label: "免费开始", href: "/register" }}
            features={[
              { label: "1 个家族", on: true },
              { label: "最多 50 人", on: true },
              { label: "关系树视图", on: true },
              { label: "字辈与支系", on: true },
              { label: "邀请码加入", on: true },
              { label: "JSON 数据导出", on: true },
              { label: "审计日志（30 天）", on: true },
              { label: "册谱 PDF 导出", on: false },
              { label: "Excel 批量导入", on: false },
              { label: "子树管理员", on: false },
            ]}
          />
          <PriceCard
            name="家族版"
            description="一户家族的标准版"
            price="¥98"
            unit="/年"
            cta={{ label: "升级家族版", href: "/register?plan=family" }}
            features={[
              { label: "1 个家族", on: true },
              { label: "最多 500 人", on: true, strong: true },
              { label: "关系树 + 吊线古谱", on: true },
              { label: "字辈与支系", on: true },
              { label: "邀请系统 + 二维码海报", on: true },
              { label: "JSON / CSV 导出", on: true },
              { label: "审计日志（1 年）", on: true },
              { label: "册谱 PDF 导出", on: true, strong: true },
              { label: "Excel 批量导入", on: true, strong: true },
              { label: "邮件支持", on: true },
            ]}
            recommended
          />
          <PriceCard
            name="宗祠版"
            description="多支系 / 多管理员的大族"
            price="¥298"
            unit="/年"
            cta={{ label: "宗祠版", href: "/register?plan=clan" }}
            features={[
              { label: "3 个家族", on: true },
              { label: "最多 5,000 人", on: true, strong: true },
              { label: "关系树 + 吊线古谱", on: true },
              { label: "高级统计 + 迁徙地图", on: true, strong: true },
              { label: "子树管理员授权", on: true, strong: true },
              { label: "GEDCOM 导出", on: true },
              { label: "审计日志（永久）", on: true },
              { label: "册谱 PDF + 印刷模板", on: true },
              { label: "Excel + PDF 老谱代录入折扣", on: true },
              { label: "微信群优先支持", on: true },
            ]}
          />
          <PriceCard
            name="永久珍藏"
            description="一次付清，传承百年"
            price="¥1,980"
            unit="一次"
            cta={{ label: "永久珍藏", href: "/register?plan=forever" }}
            features={[
              { label: "无限家族", on: true, strong: true },
              { label: "无限人数", on: true, strong: true },
              { label: "全部功能", on: true },
              { label: "永久保存承诺", on: true, strong: true },
              { label: "私有部署技术支持", on: true, strong: true },
              { label: "自定义域名 / Logo", on: true },
              { label: "整族原始数据库导出", on: true },
              { label: "1v1 客服 + 修谱顾问", on: true, strong: true },
              { label: "实体家谱印刷 8 折", on: true },
              { label: "未来新功能终身免费", on: true },
            ]}
          />
        </div>

        <p className="mt-6 text-center text-xs text-stone-500">
          所有付费版本支持 7 天无理由退款 · 自动续费可在「我的账户」一键关闭
        </p>
      </section>

      {/* ───────── 完整对照表 ───────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <SectionEyebrow>完整对照</SectionEyebrow>
          <SectionTitle>每一项功能，每一档具体什么样。</SectionTitle>
        </div>

        <div className="mt-10 overflow-x-auto rounded-2xl border border-stone-200 bg-white/70 backdrop-blur dark:border-stone-800 dark:bg-stone-900/50">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100/60 text-left dark:border-stone-800 dark:bg-stone-900/60">
                <th className="sticky left-0 px-4 py-3 font-medium text-stone-500 bg-stone-100/60 dark:bg-stone-900/60">
                  功能
                </th>
                <ColHead>免费</ColHead>
                <ColHead>家族版</ColHead>
                <ColHead highlight>宗祠版</ColHead>
                <ColHead>永久珍藏</ColHead>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {COMPARE_GROUPS.map((group) => (
                <Group key={group.title} title={group.title} rows={group.rows} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ───────── 增值服务 ───────── */}
      <section className="bg-stone-100/40 py-20 dark:bg-stone-900/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <SectionEyebrow>增值服务</SectionEyebrow>
            <SectionTitle>除了 SaaS 之外，我们也帮你做实体家谱。</SectionTitle>
            <p className="mt-4 text-stone-700 dark:text-stone-300">
              每个家族的修谱节奏不同。我们把那些「自己做不来、外面找不到」的事，做成了服务。
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Addon
              icon="📖"
              name="实体家谱印刷"
              price="¥199 起 / 册"
              desc="线装古风 / 现代精装两种装帧。一族 1 册起印，5 册以上 8 折。"
            />
            <Addon
              icon="🖋️"
              name="老家谱代录入"
              price="¥3 / 人"
              desc="把你家的老谱（扫描件 / 照片 / 复印件）由专人录入，含校对与字辈梳理。"
            />
            <Addon
              icon="🎬"
              name="家族纪录片"
              price="¥4,800 起"
              desc="3–5 分钟家族历史短片：迁徙故事、长辈访谈、字辈口诀，可投影于祭祖场合。"
            />
            <Addon
              icon="🧙"
              name="字辈续写咨询"
              price="¥800 起"
              desc="续修字辈、补支取名、合谱并支等场景的 1v1 顾问咨询。"
            />
          </div>

          <p className="mt-6 text-xs text-stone-500">
            所有增值服务均由本平台或经核验的合作工坊承接 · 加微信
            <span className="font-mono"> zupu-jia </span>咨询。
          </p>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionEyebrow>常见问题</SectionEyebrow>
        <SectionTitle>关心的问题，提前讲清楚。</SectionTitle>

        <div className="mt-10 space-y-3">
          {FAQS.map((f, i) => (
            <FAQ key={i} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* ───────── 团购 / 公益 ───────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-stone-200 bg-white/70 p-8 dark:border-stone-800 dark:bg-stone-900/50">
            <h3 className="font-serif text-xl font-semibold text-stone-900 dark:text-stone-50">
              团购 · 同县 / 同宗
            </h3>
            <p className="mt-3 text-sm text-stone-700 dark:text-stone-300">
              同县同姓家族 5 户起，宗祠版立享 7 折；
              同宗 / 跨县联宗 10 户起，永久珍藏版每户立减 ¥500。
            </p>
            <p className="mt-3 text-xs text-stone-500">
              联系方式：邮件 hello@zupu.app · 微信 zupu-jia
            </p>
          </div>
          <div className="rounded-2xl border border-rose-700/30 bg-rose-700/[0.04] p-8 dark:border-rose-400/30 dark:bg-rose-400/[0.06]">
            <h3 className="font-serif text-xl font-semibold text-rose-800 dark:text-rose-300">
              公益 · 100 户内永久免费
            </h3>
            <p className="mt-3 text-sm text-stone-700 dark:text-stone-300">
              我们承诺：100 户以下、纯家族（非商业）使用的家谱，永久免费、不限规模。
              年度修谱者只需告诉我们家族故事，由编辑组核验后即可开通。
            </p>
            <p className="mt-3 text-xs text-stone-500">
              — 让小家族也能有尊严地传承。
            </p>
          </div>
        </div>
      </section>

      {/* ───────── 终极 CTA ───────── */}
      <section className="mx-auto max-w-4xl px-4 pb-24 text-center sm:px-6 lg:px-8">
        <Divider label="终" />
        <Quote source="《礼记·大传》">尊祖故敬宗，敬宗故收族。</Quote>
        <p className="mx-auto mt-6 max-w-xl text-base text-stone-700 dark:text-stone-300">
          家谱不止是名册，更是把散落的人重新收进同一个根上。
          先免费开始，等族人多了再升级 —— 一切刚刚好。
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <PrimaryCTA href="/register" variant="vermilion">
            免费开始建谱 →
          </PrimaryCTA>
          <SecondaryCTA href="/features">查看功能详解</SecondaryCTA>
          <Link
            href="mailto:hello@zupu.app"
            className="text-sm text-stone-600 hover:text-rose-700 dark:text-stone-400 dark:hover:text-rose-400"
          >
            或联系客服 →
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </PaperBackdrop>
  );
}

/* ─────────────── 子组件 ─────────────── */

function PriceCard({
  name,
  description,
  price,
  unit,
  features,
  cta,
  recommended,
}: {
  name: string;
  description: string;
  price: string;
  unit: string;
  features: { label: string; on: boolean; strong?: boolean }[];
  cta: { label: string; href: string };
  recommended?: boolean;
}) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border p-7 ${
        recommended
          ? "border-rose-700 bg-rose-700/[0.04] shadow-xl shadow-rose-900/10 dark:border-rose-400 dark:bg-rose-400/[0.06]"
          : "border-stone-200 bg-white/70 dark:border-stone-800 dark:bg-stone-900/50"
      }`}
    >
      {recommended && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rose-700 px-3 py-1 text-[10px] font-medium tracking-wide text-rose-50">
          最受欢迎
        </span>
      )}
      <h3 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-50">
        {name}
      </h3>
      <p className="mt-1 text-xs text-stone-500">{description}</p>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="font-serif text-4xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          {price}
        </span>
        <span className="text-sm text-stone-500">{unit}</span>
      </div>

      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {features.map((f) => (
          <li
            key={f.label}
            className={`flex items-start gap-2 ${
              !f.on ? "text-stone-400 line-through dark:text-stone-600" : "text-stone-700 dark:text-stone-300"
            }`}
          >
            <span
              className={`mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                f.on
                  ? "bg-rose-700/15 text-rose-700 dark:bg-rose-400/15 dark:text-rose-400"
                  : "bg-stone-200 text-stone-400 dark:bg-stone-800 dark:text-stone-600"
              }`}
            >
              {f.on ? "✓" : "—"}
            </span>
            <span className={f.strong ? "font-medium text-stone-900 dark:text-stone-50" : ""}>
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={cta.href}
        className={`mt-6 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition ${
          recommended
            ? "bg-rose-700 text-rose-50 hover:bg-rose-800"
            : "border border-stone-300 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800"
        }`}
      >
        {cta.label} →
      </Link>
    </div>
  );
}

function ColHead({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <th
      className={`px-4 py-3 text-left font-medium ${
        highlight ? "text-rose-700 dark:text-rose-400" : "text-stone-500"
      }`}
    >
      {children}
    </th>
  );
}

function Group({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; values: (string | boolean)[] }[];
}) {
  return (
    <>
      <tr>
        <td colSpan={5} className="bg-stone-50/80 px-4 py-2 text-[11px] font-medium tracking-wider text-stone-500 uppercase dark:bg-stone-900/40">
          {title}
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.name}>
          <td className="sticky left-0 bg-white/90 px-4 py-3 text-stone-700 dark:bg-stone-900/80 dark:text-stone-300">
            {r.name}
          </td>
          {r.values.map((v, i) => (
            <td key={i} className="px-4 py-3">
              <Cell value={v} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Cell({ value }: { value: string | boolean }) {
  if (value === true)
    return <span className="text-rose-700 dark:text-rose-400">✓</span>;
  if (value === false)
    return <span className="text-stone-300 dark:text-stone-700">—</span>;
  return <span className="text-stone-700 dark:text-stone-300">{value}</span>;
}

function Addon({
  icon,
  name,
  price,
  desc,
}: {
  icon: string;
  name: string;
  price: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/70 p-5 dark:border-stone-800 dark:bg-stone-900/50">
      <div className="text-2xl" aria-hidden>
        {icon}
      </div>
      <h3 className="mt-3 font-serif text-base font-semibold text-stone-900 dark:text-stone-50">
        {name}
      </h3>
      <div className="mt-1 text-sm font-medium text-rose-700 dark:text-rose-400">
        {price}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
        {desc}
      </p>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-stone-200 bg-white/70 p-5 transition open:bg-white dark:border-stone-800 dark:bg-stone-900/50 dark:open:bg-stone-900/70">
      <summary className="flex cursor-pointer items-start justify-between gap-4 text-base font-medium text-stone-900 marker:hidden dark:text-stone-50 [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{q}</span>
        <span className="mt-1 text-stone-400 transition group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
        {a}
      </div>
    </details>
  );
}

/* ─────────────── 数据 ─────────────── */

const COMPARE_GROUPS: {
  title: string;
  rows: { name: string; values: (string | boolean)[] }[];
}[] = [
  {
    title: "规模",
    rows: [
      { name: "家族数量", values: ["1", "1", "3", "无限"] },
      { name: "成员上限", values: ["50 人", "500 人", "5,000 人", "无限"] },
      { name: "管理员数量", values: ["1（族长）", "3", "10", "无限"] },
      { name: "子树管理员", values: [false, false, true, true] },
    ],
  },
  {
    title: "录入与导入",
    rows: [
      { name: "手工添加 / 关系编辑", values: [true, true, true, true] },
      { name: "Excel 批量导入", values: [false, true, true, true] },
      { name: "老谱 PDF / 图片代录入折扣", values: [false, false, "9 折", "8 折"] },
      { name: "审核中提交（待审）", values: [true, true, true, true] },
    ],
  },
  {
    title: "查看与排版",
    rows: [
      { name: "关系树（父母 / 配偶 / 子女）", values: [true, true, true, true] },
      { name: "吊线古谱排版", values: [true, true, true, true] },
      { name: "字辈与支系视图", values: [true, true, true, true] },
      { name: "居住地继承 / 迁徙图", values: [false, true, true, true] },
      { name: "册谱 PDF 导出（线装样式）", values: [false, true, true, true] },
    ],
  },
  {
    title: "权限与协作",
    rows: [
      { name: "邀请码 / 邀请链接", values: [true, true, true, true] },
      { name: "二维码海报", values: [false, true, true, true] },
      { name: "审计日志保留", values: ["30 天", "1 年", "永久", "永久"] },
      { name: "细粒度子树授权", values: [false, false, true, true] },
    ],
  },
  {
    title: "导出与所有权",
    rows: [
      { name: "JSON 导出", values: [true, true, true, true] },
      { name: "CSV 导出", values: [false, true, true, true] },
      { name: "GEDCOM 国际通用导出", values: [false, false, true, true] },
      { name: "整族原始数据库导出", values: [false, false, false, true] },
      { name: "私有部署 / 自托管支持", values: [false, false, false, true] },
    ],
  },
  {
    title: "支持",
    rows: [
      { name: "邮件支持", values: [false, true, true, true] },
      { name: "微信群优先支持", values: [false, false, true, true] },
      { name: "1v1 客服 + 修谱顾问", values: [false, false, false, true] },
      { name: "未来新功能", values: ["免费", "免费", "免费", "终身免费"] },
    ],
  },
];

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "数据会不会丢失？我家几代人的修谱心血。",
    a: (
      <>
        所有数据存储在国内云服务商的多可用区数据库，每日自动加密备份，并保留 30 天异地副本。
        永久珍藏版用户额外提供按月的本地数据包邮件副本，最坏情况你也能从一份 ZIP 还原全族。
        付费用户可随时一键导出
        <strong className="text-stone-900 dark:text-stone-50"> JSON / GEDCOM </strong>
        到自己电脑，
        <strong className="text-stone-900 dark:text-stone-50"> 数据完全归你 </strong>。
      </>
    ),
  },
  {
    q: "可以退款吗？",
    a: "所有付费版本支持 7 天无理由退款，原路退回。永久珍藏版超过 30 天后不支持退款，但仍可一键导出全部数据。",
  },
  {
    q: "免费版的 50 人限制是什么意思？",
    a: "指当前家族中状态为「在录」的 person 总数。已删除 / 历史记录不算。如果你只是来看演示，永远不会触达上限。",
  },
  {
    q: "宗祠版的'子树管理员'怎么用？",
    a: (
      <>
        宗祠常见场景：长支族长是总族长，但分支远迁外地，主谱难以及时更新。族长可以把某一支（指定一位「分支祖」）的写权限授权给该分支的代表，
        他只能管自己这一支，但同辈仍然在主谱里对齐。这是别的家谱工具做不到的。
      </>
    ),
  },
  {
    q: "支持联合多家共修同一本族谱吗？",
    a: "支持。族长可邀请多位管理员协作；并且可以把一棵子树授权给该支自己的代表（子树管理员），主支与分支同辈对齐互不打架。",
  },
  {
    q: "支持手机 / 微信小程序吗？",
    a: (
      <>
        网页端已经响应式适配手机。
        <strong className="text-stone-900 dark:text-stone-50"> 微信小程序计划 2026 春节前上线</strong>
        ，详情见
        <Link href="/about#mp" className="text-rose-700 underline dark:text-rose-400">
          {" "}/about{" "}
        </Link>
        。注册后会通过短信通知你小程序上线消息。
      </>
    ),
  },
  {
    q: "我家族谱历史长，名字带繁体 / 异体字 / 罕见字行不行？",
    a: "全程 Unicode（含 CJK 扩展 B/C/D），支持繁体、异体、行名、堂号、生卒纪年、谥号、官名、墓地等中国家谱特有字段。",
  },
  {
    q: "可以发票吗？",
    a: "可开具增值税普通发票（电子）。企业 / 宗祠组织开专票请联系客服。",
  },
];
