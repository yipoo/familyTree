/**
 * 营销首页（未登录访客）
 *
 * 结构：
 *   1. Hero — 主张 + 双 CTA + 视觉印章
 *   2. 痛点共鸣 — 旧家谱失传的 4 个真实场景
 *   3. 核心功能 12 宫格
 *   4. 现代 vs 传统 对比
 *   5. 数据 / 演示
 *   6. 社交证明 / 用户故事
 *   7. 价格预览 → /pricing
 *   8. 病毒邀请 CTA
 *   9. Footer
 */
import Link from "next/link";

import { auth } from "@/auth";
import {
  PaperBackdrop,
  SealStamp,
  SectionEyebrow,
  SectionTitle,
  PrimaryCTA,
  SecondaryCTA,
  Divider,
  Quote,
} from "@/components/marketing/elements";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/Footer";

export async function Landing() {
  const session = await auth();
  const loggedIn = Boolean(session?.user?.id);
  const primaryHref = loggedIn ? "/dashboard" : "/register";
  const primaryLabel = loggedIn ? "进入我的家族 →" : "免费开始建谱 →";

  return (
    <PaperBackdrop>
      <MarketingNav active="/" />

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8 lg:pt-20 lg:pb-28">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-rose-700/20 bg-rose-700/5 px-3 py-1 text-xs font-medium text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-700 dark:bg-rose-400" />
              支持 字辈 · 支系 · 嫁入嫁出 · 居住地继承 · 中国式宗谱
            </div>

            <h1 className="font-serif text-4xl font-semibold leading-[1.15] tracking-tight text-stone-900 dark:text-stone-50 sm:text-5xl lg:text-6xl">
              把家族的故事，
              <br className="hidden sm:block" />
              <span className="relative inline-block">
                <span className="relative z-10 text-rose-700 dark:text-rose-400">
                  刻进时间
                </span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-1 -z-0 h-3 bg-rose-700/15 dark:bg-rose-400/20"
                />
              </span>
              。
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-stone-700 dark:text-stone-300 sm:text-lg">
              旧家谱发霉脆化、长辈口耳相传渐渐遗失。我们为中国家族打造一个
              <strong className="font-medium text-stone-900 dark:text-stone-50">
                现代化、可协作、可永久保存
              </strong>
              的家谱平台 —— 支持关系树、吊线古谱、字辈分支、册谱 PDF 导出，全族成员一起编修。
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PrimaryCTA href={primaryHref} variant="vermilion">
                {primaryLabel}
              </PrimaryCTA>
              <SecondaryCTA href="/features">查看完整功能</SecondaryCTA>
              <Link
                href="/about#demo"
                className="text-sm text-stone-600 hover:text-rose-700 dark:text-stone-400 dark:hover:text-rose-400"
              >
                先看演示家族 →
              </Link>
            </div>

            <ul className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-stone-500 dark:text-stone-400">
              <Hint>✓ 50 人以下永久免费</Hint>
              <Hint>✓ 一键导出 GEDCOM / 册谱 PDF</Hint>
              <Hint>✓ 数据完全归你所有</Hint>
            </ul>
          </div>

          {/* Hero 视觉：宗谱卡片堆叠 */}
          <div className="relative hidden lg:block">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* ───────── 信任 / 数字带 ───────── */}
      <section className="border-y border-stone-200/70 bg-stone-50/40 py-8 dark:border-stone-800 dark:bg-stone-900/30">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 text-center sm:grid-cols-4 sm:px-6 lg:px-8">
          <Metric value="120+" label="参与家族" />
          <Metric value="38,000+" label="登记族人" />
          <Metric value="26 省" label="迁徙覆盖" />
          <Metric value="1,200 年" label="最长可追溯" />
        </div>
      </section>

      {/* ───────── 痛点 ───────── */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <SectionEyebrow>为何要现在做家谱</SectionEyebrow>
          <SectionTitle>每多等一年，就少一段记忆。</SectionTitle>
          <p className="mt-4 text-base text-stone-700 dark:text-stone-300">
            家族记忆从来没有像今天这样脆弱过——纸谱、群聊、长辈口述，正在一年年地流失。
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <PainPoint
            icon="📜"
            title="老家谱发霉脆化"
            text="家中的旧谱页角断裂，扫描后一千张图片无法检索，长辈走后再无人识读。"
          />
          <PainPoint
            icon="🌫️"
            title="字辈支系记不清"
            text="同一个'国'字辈下分十几支，谁是嫡系、谁是迁出，问到第三代就开始打架。"
          />
          <PainPoint
            icon="📱"
            title="春节群里 200 人"
            text="家族微信群里全是表情包，谁是谁、孩子叫什么、住在哪里没人讲得清。"
          />
          <PainPoint
            icon="🧭"
            title="散落各地的族人"
            text="两百年前一支迁出，至今下落不明。同姓的人见面问族谱，问到祖父就接不上。"
          />
        </div>
      </section>

      {/* ───────── 核心功能 ───────── */}
      <section className="bg-stone-100/40 py-24 dark:bg-stone-900/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <SectionEyebrow>核心功能</SectionEyebrow>
            <SectionTitle>一个平台，把宗谱该有的能力，全做对。</SectionTitle>
            <p className="mt-4 text-base text-stone-700 dark:text-stone-300">
              不是 GEDCOM 工具的中文翻译，而是为中国家谱本来的样子设计 ——
              支持<strong>字辈、支系、嫁入嫁出、居住地继承、子树管理员</strong>，每一条都来自真实的修谱场景。
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              title="关系树"
              desc="父母 / 配偶 / 子女三向滑动，一个手势走完五代。"
              tag="树谱"
            />
            <Feature
              title="吊线古谱"
              desc="千年传统的吊线图排版，同辈对齐、嫁入红字、嫁出虚线，一键打印整族。"
              tag="古谱"
              accent
            />
            <Feature
              title="字辈与支系"
              desc="同 N 世自动对齐，多支系并排，长支幼支井然有序。"
              tag="字辈"
            />
            <Feature
              title="居住地继承"
              desc="迁徙路径自动追溯——'江西 → 湖广 → 四川'三百年迁徙线一目了然。"
              tag="迁徙"
            />
            <Feature
              title="多角色权限"
              desc="族长、管理员、成员、访客；可授权某长辈管理自己一支（子树管理员）。"
              tag="权限"
            />
            <Feature
              title="邀请系统"
              desc="生成 8 位邀请码或扫码海报，族人扫一扫即加入对应支系。"
              tag="拉新"
            />
            <Feature
              title="审计日志"
              desc="谁改了谁、何时改、改了什么，全部可回溯，避免误删长辈。"
              tag="可信"
            />
            <Feature
              title="册谱 PDF"
              desc="一键生成传统线装册式家谱 PDF——可印刷成实体谱书赠予长辈。"
              tag="导出"
              accent
            />
            <Feature
              title="Excel 批量导入"
              desc="把家中那份十几年前的 Excel 老底册整批迁过来，自动校验关系一致性。"
              tag="导入"
            />
            <Feature
              title="国际通用导出"
              desc="JSON / CSV / GEDCOM 三种格式，数据归你；可导入海外家谱平台。"
              tag="自由"
            />
            <Feature
              title="家族统计"
              desc="寿命分布、男女比、迁徙地图、世代繁衍曲线——做家训分析的底料。"
              tag="洞察"
            />
            <Feature
              title="私密分享"
              desc="按支系生成临时分享链接 / 二维码海报，过期自动失效。"
              tag="分享"
            />
          </div>

          <div className="mt-10 flex justify-center">
            <SecondaryCTA href="/features">每项功能详细介绍 →</SecondaryCTA>
          </div>
        </div>
      </section>

      {/* ───────── 对比表 ───────── */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <SectionEyebrow>为何选我们</SectionEyebrow>
          <SectionTitle>四种现状的对比，看完就知道差距。</SectionTitle>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-stone-200 bg-white/70 backdrop-blur dark:border-stone-800 dark:bg-stone-900/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100/60 text-left dark:border-stone-800 dark:bg-stone-900/60">
                <th className="px-4 py-3 font-medium text-stone-500">对比项</th>
                <th className="px-4 py-3 font-medium text-stone-500">纸质家谱</th>
                <th className="px-4 py-3 font-medium text-stone-500">Excel / Word</th>
                <th className="px-4 py-3 font-medium text-stone-500">国外 GEDCOM 工具</th>
                <th className="px-4 py-3 font-medium text-rose-700 dark:text-rose-400">族谱·家</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              <CompareRow row={["保存寿命", "30 年（霉变）", "易丢失", "依赖软件存活", "云端永久 + 一键导出"]} />
              <CompareRow row={["关系一致性", "靠老人记忆", "无校验", "✓", "✓ 含中文特殊字段"]} />
              <CompareRow row={["字辈 / 支系", "✓", "勉强", "✗ 无概念", "✓ 原生支持"]} />
              <CompareRow row={["嫁入嫁出标识", "✓", "易混乱", "✗", "✓ 红黑分明"]} />
              <CompareRow row={["多人协作", "✗", "改一次发一次", "限单机", "✓ 子树管理员"]} />
              <CompareRow row={["移动端浏览", "✗", "Excel 难用", "差", "✓ 响应式 + 即将上线小程序"]} />
              <CompareRow row={["数据所有权", "你", "你", "厂商", "你（随时导出）"]} highlight />
            </tbody>
          </table>
        </div>
      </section>

      {/* ───────── 演示 / 截屏区 ───────── */}
      <section className="bg-stone-100/40 py-24 dark:bg-stone-900/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>看一眼真实界面</SectionEyebrow>
            <SectionTitle align="center">古老的内容，现代的体验。</SectionTitle>
            <p className="mt-4 text-base text-stone-700 dark:text-stone-300">
              不止于「能用」——我们花了同样的心思在每一个圆角、每一种字号、每一处留白。
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            <ShowcaseCard
              title="关系树"
              caption="父母 / 配偶 / 子女三向滑动"
              tone="ink"
            >
              <TreePreview />
            </ShowcaseCard>
            <ShowcaseCard
              title="吊线古谱"
              caption="同辈对齐 · 嫁入红字"
              tone="paper"
            >
              <LineagePreview />
            </ShowcaseCard>
            <ShowcaseCard
              title="家族统计"
              caption="寿命 · 迁徙 · 世代繁衍"
              tone="ink"
            >
              <StatsPreview />
            </ShowcaseCard>
          </div>
        </div>
      </section>

      {/* ───────── 用户故事 ───────── */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <SectionEyebrow>族人怎么说</SectionEyebrow>
          <SectionTitle>一年间，我们见证了上百个家族重新开始修谱。</SectionTitle>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Testimonial
            quote="去年清明，家中老谱已经霉得翻不动了。我把照片整批导入族谱·家，三天就把六代族人重新对齐。今年回家，全族第一次围坐看着同一个屏幕认人。"
            author="张族长"
            sub="湖南益阳张氏 · 在册 2,400 人"
          />
          <Testimonial
            quote="我家是独立一支，主谱在族长那里。族谱·家允许族长把我这一支授权给我自己管理，互不干扰，但同辈仍然对齐——这是别的工具做不到的。"
            author="李叔"
            sub="广东李氏迁台分支 · 子树管理员"
          />
          <Testimonial
            quote="嫁入家媳家族标识、字辈对齐、居住地继承——一看就是真做过家谱的人才设计得出来。它懂我们家族的复杂性。"
            author="王秘书长"
            sub="某宗祠理事会 · 8,000 人在录"
          />
        </div>
      </section>

      {/* ───────── 价格预览 ───────── */}
      <section className="bg-gradient-to-b from-rose-700/5 via-transparent to-transparent py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <SectionEyebrow>价格</SectionEyebrow>
            <SectionTitle>简单、透明，没有隐藏条款。</SectionTitle>
            <p className="mt-4 text-base text-stone-700 dark:text-stone-300">
              50 人以下家族永久免费。规模更大，再升级。
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <PricePreview
              name="免费版"
              price="¥0"
              unit="永久"
              highlights={["1 个家族", "最多 50 人", "关系树 + 字辈", "JSON 导出"]}
            />
            <PricePreview
              name="家族版"
              price="¥98"
              unit="/年"
              highlights={["最多 500 人", "册谱 PDF", "Excel 导入", "邮件支持"]}
              recommended
            />
            <PricePreview
              name="宗祠版"
              price="¥298"
              unit="/年"
              highlights={["最多 5,000 人", "子树管理员", "高级统计", "微信群支持"]}
            />
            <PricePreview
              name="永久珍藏"
              price="¥1,980"
              unit="一次"
              highlights={["无限规模", "永久保存", "私有部署支持", "1v1 客服"]}
            />
          </div>

          <div className="mt-10 flex justify-center">
            <SecondaryCTA href="/pricing">查看完整价格对照表 →</SecondaryCTA>
          </div>
        </div>
      </section>

      {/* ───────── 病毒邀请 CTA ───────── */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-rose-700/20 bg-[radial-gradient(70%_140%_at_30%_30%,rgba(168,32,31,0.10),transparent)] p-10 dark:border-rose-400/20 sm:p-14">
          <div
            aria-hidden
            className="absolute -right-10 -top-10 hidden lg:block"
          >
            <SealStamp size="lg">族</SealStamp>
          </div>

          <div className="max-w-2xl">
            <SectionEyebrow>邀请有礼</SectionEyebrow>
            <SectionTitle>叫上族里五位长辈，家族版免费一个月。</SectionTitle>
            <p className="mt-4 text-base leading-relaxed text-stone-700 dark:text-stone-300">
              修家谱不是一个人的事。每邀请 5 位族人成功注册，双方各得家族版 30 天体验。
              邀请 50 人，全年免费。
              <br />
              到春节、清明、重阳，把家族二维码海报发到群里，扫一扫看到自己在第几世——这是新一代家族凝聚的方式。
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <PrimaryCTA href={primaryHref} variant="vermilion">
                {loggedIn ? "进入我的家族邀请族人 →" : "立即注册，开始邀请 →"}
              </PrimaryCTA>
              <SecondaryCTA href="/about#invite">邀请规则详情</SecondaryCTA>
            </div>
          </div>

          <Divider label="慎终追远" />

          <Quote source="《论语·学而》">慎终追远，民德归厚矣。</Quote>
        </div>
      </section>

      <MarketingFooter />
    </PaperBackdrop>
  );
}

/* ─────────────────── 子组件 ─────────────────── */

function Hint({ children }: { children: React.ReactNode }) {
  return <li className="font-medium">{children}</li>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-serif text-2xl font-semibold tracking-tight text-rose-700 dark:text-rose-400 sm:text-3xl">
        {value}
      </div>
      <div className="mt-1 text-xs text-stone-500 sm:text-sm">{label}</div>
    </div>
  );
}

function PainPoint({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/70 p-5 backdrop-blur transition hover:border-rose-700/30 hover:shadow-sm dark:border-stone-800 dark:bg-stone-900/50">
      <div className="text-2xl" aria-hidden>
        {icon}
      </div>
      <h3 className="mt-3 font-serif text-base font-semibold text-stone-900 dark:text-stone-50">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
        {text}
      </p>
    </div>
  );
}

function Feature({
  title,
  desc,
  tag,
  accent,
}: {
  title: string;
  desc: string;
  tag: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md ${
        accent
          ? "border-rose-700/30 bg-rose-700/5 dark:border-rose-400/30 dark:bg-rose-400/5"
          : "border-stone-200 bg-white/70 dark:border-stone-800 dark:bg-stone-900/50"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${
            accent
              ? "bg-rose-700/15 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300"
              : "bg-stone-200/80 text-stone-700 dark:bg-stone-800 dark:text-stone-300"
          }`}
        >
          {tag}
        </span>
      </div>
      <h3 className="font-serif text-base font-semibold text-stone-900 dark:text-stone-50">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
        {desc}
      </p>
    </div>
  );
}

function CompareRow({
  row,
  highlight,
}: {
  row: [string, string, string, string, string];
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? "bg-rose-700/[0.04] dark:bg-rose-400/[0.06]" : ""}>
      <td className="px-4 py-3 font-medium text-stone-700 dark:text-stone-300">{row[0]}</td>
      <td className="px-4 py-3 text-stone-500">{row[1]}</td>
      <td className="px-4 py-3 text-stone-500">{row[2]}</td>
      <td className="px-4 py-3 text-stone-500">{row[3]}</td>
      <td className="px-4 py-3 font-medium text-rose-700 dark:text-rose-400">
        {row[4]}
      </td>
    </tr>
  );
}

function ShowcaseCard({
  title,
  caption,
  children,
  tone,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
  tone: "ink" | "paper";
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        tone === "ink"
          ? "border-stone-800 bg-stone-900 text-stone-100"
          : "border-stone-200 bg-[#fbf7ee] text-stone-900"
      }`}
    >
      <div className="aspect-[4/3] w-full p-6">{children}</div>
      <div
        className={`flex items-baseline justify-between border-t px-5 py-3 text-sm ${
          tone === "ink" ? "border-stone-800" : "border-stone-200"
        }`}
      >
        <strong className="font-serif text-base font-semibold">{title}</strong>
        <span className="text-xs opacity-70">{caption}</span>
      </div>
    </div>
  );
}

/* ────── 关系树 mini 预览 ────── */
function TreePreview() {
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full">
      <defs>
        <linearGradient id="treeGold" x1="0" x2="1">
          <stop offset="0" stopColor="#c9a85c" />
          <stop offset="1" stopColor="#a8201f" />
        </linearGradient>
      </defs>
      {/* 连线 */}
      <g stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" fill="none">
        <path d="M200 60 V 120" />
        <path d="M200 120 H 100 V 180" />
        <path d="M200 120 H 200 V 180" />
        <path d="M200 120 H 300 V 180" />
        <path d="M100 220 V 250" />
      </g>
      {/* 节点 */}
      <Node x={200} y={40} label="先祖" sub="第 14 世" big />
      <Node x={100} y={200} label="长子" sub="国字辈" />
      <Node x={200} y={200} label="次子" sub="国字辈" />
      <Node x={300} y={200} label="幼女" sub="嫁出" muted />
      <Node x={100} y={260} label="长孙" sub="第 16 世" small />
    </svg>
  );
}

function Node({
  x,
  y,
  label,
  sub,
  big,
  small,
  muted,
}: {
  x: number;
  y: number;
  label: string;
  sub: string;
  big?: boolean;
  small?: boolean;
  muted?: boolean;
}) {
  const w = big ? 130 : small ? 80 : 110;
  const h = big ? 44 : small ? 32 : 38;
  return (
    <g transform={`translate(${x - w / 2}, ${y - h / 2})`}>
      <rect
        width={w}
        height={h}
        rx={6}
        className={muted ? "fill-stone-700/60 stroke-stone-500/40" : "fill-stone-800 stroke-stone-700"}
        strokeWidth="1"
      />
      <text x={w / 2} y={h / 2 - 2} textAnchor="middle" className="fill-stone-50 font-serif" fontSize={big ? 14 : small ? 10 : 12} fontWeight={600}>
        {label}
      </text>
      <text x={w / 2} y={h / 2 + 12} textAnchor="middle" className="fill-stone-400" fontSize={big ? 10 : 8}>
        {sub}
      </text>
    </g>
  );
}

/* ────── 吊线古谱 mini 预览 ────── */
function LineagePreview() {
  const cols = ["王元正", "王元盛", "王元昌", "王元明", "王元达"];
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full">
      <line x1="20" y1="40" x2="380" y2="40" stroke="#0c0a09" strokeWidth="1.5" />
      <line x1="20" y1="200" x2="380" y2="200" stroke="#0c0a09" strokeWidth="1.5" />
      <text x="200" y="22" textAnchor="middle" className="fill-stone-700 font-serif" fontSize="12">
        第十五世 · 元字辈
      </text>
      {cols.map((n, i) => {
        const x = 50 + i * 75;
        const isMarry = i === 4;
        return (
          <g key={i}>
            <line x1={x} y1="40" x2={x} y2="80" stroke="#0c0a09" strokeWidth="1" />
            <rect x={x - 22} y="80" width="44" height="60" fill="#fff" stroke="#0c0a09" strokeWidth="1" />
            <text
              x={x}
              y="108"
              textAnchor="middle"
              className={isMarry ? "fill-rose-700" : "fill-stone-900"}
              fontFamily="serif"
              fontSize="14"
              fontWeight={500}
              style={{ writingMode: "vertical-rl" } as React.CSSProperties}
            >
              {n}
            </text>
            <line x1={x} y1="140" x2={x} y2="200" stroke="#0c0a09" strokeWidth="1" strokeDasharray={isMarry ? "3 3" : ""} />
          </g>
        );
      })}
      <text x="200" y="240" textAnchor="middle" className="fill-stone-500 font-serif" fontSize="11">
        ※ 红字为嫁入 · 虚线为嫁出
      </text>
    </svg>
  );
}

/* ────── 统计 mini 预览 ────── */
function StatsPreview() {
  const bars = [12, 28, 45, 60, 38, 22, 14];
  return (
    <svg viewBox="0 0 400 280" className="h-full w-full">
      <text x="20" y="30" className="fill-stone-100 font-serif" fontSize="14" fontWeight={600}>
        各世代人数
      </text>
      <text x="20" y="48" className="fill-stone-400" fontSize="10">
        第 12–18 世
      </text>
      {bars.map((v, i) => (
        <g key={i}>
          <rect
            x={40 + i * 50}
            y={250 - v * 3}
            width="32"
            height={v * 3}
            rx="2"
            fill="url(#barGrad)"
          />
          <text
            x={40 + i * 50 + 16}
            y="265"
            textAnchor="middle"
            className="fill-stone-500"
            fontSize="9"
          >
            {12 + i}
          </text>
        </g>
      ))}
      <defs>
        <linearGradient id="barGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#c9a85c" />
          <stop offset="1" stopColor="#a8201f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Testimonial({
  quote,
  author,
  sub,
}: {
  quote: string;
  author: string;
  sub: string;
}) {
  return (
    <figure className="flex h-full flex-col rounded-xl border border-stone-200 bg-white/70 p-6 backdrop-blur dark:border-stone-800 dark:bg-stone-900/50">
      <span aria-hidden className="font-serif text-3xl leading-none text-rose-700/60 dark:text-rose-400/60">
        ❝
      </span>
      <blockquote className="mt-2 flex-1 font-serif text-base leading-relaxed text-stone-800 dark:text-stone-200">
        {quote}
      </blockquote>
      <figcaption className="mt-5 border-t border-stone-200 pt-4 text-sm dark:border-stone-800">
        <div className="font-medium text-stone-900 dark:text-stone-50">— {author}</div>
        <div className="text-xs text-stone-500">{sub}</div>
      </figcaption>
    </figure>
  );
}

function PricePreview({
  name,
  price,
  unit,
  highlights,
  recommended,
}: {
  name: string;
  price: string;
  unit: string;
  highlights: string[];
  recommended?: boolean;
}) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-xl border p-6 ${
        recommended
          ? "border-rose-700 bg-rose-700/5 shadow-lg shadow-rose-900/10 dark:border-rose-400 dark:bg-rose-400/5"
          : "border-stone-200 bg-white/70 dark:border-stone-800 dark:bg-stone-900/50"
      }`}
    >
      {recommended && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rose-700 px-3 py-1 text-[10px] font-medium tracking-wide text-rose-50">
          最受欢迎
        </span>
      )}
      <h3 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-50">{name}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-serif text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          {price}
        </span>
        <span className="text-sm text-stone-500">{unit}</span>
      </div>
      <ul className="mt-5 space-y-2 text-sm text-stone-700 dark:text-stone-300">
        {highlights.map((h) => (
          <li key={h} className="flex items-start gap-2">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-rose-700 dark:bg-rose-400" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ────── Hero 视觉：三层卡片堆叠 ────── */
function HeroVisual() {
  return (
    <div className="relative aspect-square w-full">
      {/* 背景印章 */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2">
        <div className="rotate-3">
          <SealStamp size="lg">族</SealStamp>
        </div>
      </div>

      {/* 卡片 1：吊线古谱 */}
      <div className="absolute left-0 top-6 w-72 rotate-[-4deg] rounded-xl border border-stone-200 bg-[#fbf7ee] p-5 shadow-xl shadow-stone-900/10 dark:border-stone-800">
        <div className="mb-3 text-center font-serif text-sm font-semibold text-stone-900">
          王氏宗谱 · 第十五世
        </div>
        <div className="grid grid-cols-5 gap-1">
          {["元正", "元盛", "元昌", "元明", "元达"].map((n, i) => (
            <div
              key={i}
              className={`rounded-sm border border-stone-300 bg-white px-1 py-2 text-center font-serif text-xs ${
                i === 4 ? "text-rose-700" : "text-stone-900"
              }`}
              style={{ writingMode: "vertical-rl" } as React.CSSProperties}
            >
              {n}
            </div>
          ))}
        </div>
        <div className="mt-3 text-center text-[10px] text-stone-500">
          — 长支 嫡 元字辈 —
        </div>
      </div>

      {/* 卡片 2：关系树 */}
      <div className="absolute right-4 top-32 w-64 rotate-[5deg] rounded-xl border border-stone-700 bg-stone-900 p-5 shadow-xl shadow-stone-900/30">
        <div className="mb-3 text-xs font-medium tracking-wide text-stone-400">
          关系树视图
        </div>
        <div className="space-y-3">
          <div className="rounded-md bg-rose-700/20 px-3 py-2 text-center font-serif text-sm text-rose-100">
            王元正 · 14 世
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-stone-800 px-2 py-1.5 text-center text-xs text-stone-200">
              王国华
            </div>
            <div className="rounded-md bg-stone-800 px-2 py-1.5 text-center text-xs text-stone-200">
              王国梁
            </div>
          </div>
        </div>
      </div>

      {/* 卡片 3：统计小卡 */}
      <div className="absolute bottom-4 left-12 w-56 rounded-xl border border-stone-200 bg-white p-4 shadow-xl shadow-stone-900/10 dark:border-stone-800 dark:bg-stone-900">
        <div className="text-[10px] tracking-wide text-stone-500">家族在册</div>
        <div className="mt-1 font-serif text-2xl font-semibold text-stone-900 dark:text-stone-50">
          2,418 <span className="text-sm font-normal text-stone-400">人</span>
        </div>
        <div className="mt-3 flex items-end gap-1 h-12">
          {[8, 14, 20, 28, 36, 30, 22, 14].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-gradient-to-t from-rose-700 to-amber-500"
              style={{ height: `${h * 2.5}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
