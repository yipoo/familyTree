/**
 * /about —— 故事 / 路线图 / 病毒传播计划 / 数据安全
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
  title: "故事 & 路线图 · 族谱·家",
  description: "为什么我们做家谱平台？病毒邀请计划、小程序进度、同姓寻根、数据安全承诺。",
};

export default function AboutPage() {
  return (
    <PaperBackdrop>
      <MarketingNav active="/about" />

      {/* ───── Hero ───── */}
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto mb-5 inline-flex">
          <SealStamp size="md">本</SealStamp>
        </div>
        <SectionEyebrow>
          <span className="mx-auto">我们的故事</span>
        </SectionEyebrow>
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-5xl">
          家族不是社交，是根。
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-stone-700 dark:text-stone-300">
          这个平台的起点是一卷江西老谱。<br />
          十几代人手抄修订，到我祖父那一辈断了线。我们不想看着每一户家族都重复这个故事。
        </p>
      </section>

      {/* ───── 我们的故事 ───── */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-stone-200 bg-white/70 p-8 dark:border-stone-800 dark:bg-stone-900/50 sm:p-12">
          <Quote source="《左传·昭公七年》">
            天有十日，人有十等。下所以事上，上所以共神也。
          </Quote>

          <div className="mt-6 space-y-4 text-base leading-loose text-stone-800 dark:text-stone-200">
            <p>
              很多人会觉得，今天还修家谱是不是太老旧？我们的回答是：
              <strong className="font-semibold">恰恰相反，今天才是最该做的时候。</strong>
            </p>
            <p>
              过去二十年里，城镇化把同一个村的兄弟分散到不同省份；
              同一个支系下的孩子，从小没见过面。家族关系第一次真正脆弱起来。
            </p>
            <p>
              而手机和云端，第一次让「全族协作修一本谱」在技术上变得可能。
              不再是某一位族长熬十年攒一本——
              而是<strong className="font-semibold">五十口子人，每人贡献自己那一支</strong>，最后合成一本完整的谱。
            </p>
            <p>
              这就是族谱·家想做的：把祖宗的工具，换成今天的工艺；把传家的责任，分担给整个家族。
            </p>
          </div>
        </div>
      </section>

      {/* ───── 病毒邀请 ───── */}
      <section
        id="invite"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="max-w-2xl">
          <SectionEyebrow>邀请计划</SectionEyebrow>
          <SectionTitle>修家谱不是一个人的事，平台也不该是。</SectionTitle>
          <p className="mt-4 text-base leading-relaxed text-stone-700 dark:text-stone-300">
            我们设计了五种激励，让「邀请家人」成为修谱过程中最自然的一步。
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ViralCard
            badge="✦ 推荐有礼"
            title="邀请 5 人 = 家族版 30 天"
            desc="每邀请 5 位族人成功注册，双方各得家族版 30 天体验；邀请 50 人，全年免费。"
            cta="即将上线"
          />
          <ViralCard
            badge="✦ 节日海报"
            title="春节 / 清明 / 重阳 二维码海报"
            desc="一键生成节日定制海报：家族名 + 二维码 + 字辈口诀。发到家族群里，扫一扫看自己在第几世。"
            cta="已上线"
            on
          />
          <ViralCard
            badge="✦ 同姓寻根"
            title="自动匹配同姓家族"
            desc="系统按姓氏 + 祖籍地 + 字辈，匹配同源的其它家族。失散两百年的支系，可能就在隔壁省。"
            cta="2026 Q2"
          />
          <ViralCard
            badge="✦ 春运红包"
            title="扫族谱二维码 → 抢家族红包"
            desc="春节定制玩法：族长充值红包池，族人扫码进谱即可抽取，按辈分加成。"
            cta="2026 春节"
          />
          <ViralCard
            badge="✦ 家族故事"
            title="UGC 长辈传记 → 公众号 / 朋友圈"
            desc="为族中名人写一篇传记，一键生成长图文，可分享到朋友圈与公众号；族人转发即可获徽章。"
            cta="2026 Q3"
          />
          <ViralCard
            badge="✦ 公益谱"
            title="100 户内永久免费"
            desc="小家族不该被价格挡在门外。100 户以下、纯家族使用永久免费，由编辑组核验后开通。"
            cta="已上线"
            on
            highlight
          />
        </div>
      </section>

      {/* ───── 小程序 ───── */}
      <section
        id="mp"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div className="relative mx-auto w-72">
            {/* 假手机壳 */}
            <div className="rounded-[42px] border-[10px] border-stone-900 bg-stone-900 p-1 shadow-2xl dark:border-stone-700">
              <div className="overflow-hidden rounded-[34px] bg-[#fbf7ee] aspect-[9/19] flex flex-col">
                <div className="bg-rose-700 px-5 py-4 text-rose-50">
                  <div className="text-[10px] opacity-80">微信小程序 · BETA</div>
                  <div className="mt-1 font-serif text-base font-semibold">王氏宗谱</div>
                  <div className="text-[10px] opacity-70">14 世 王元正 · 在线 12 人</div>
                </div>
                <div className="flex-1 space-y-2 p-4 text-stone-800">
                  <div className="rounded-lg bg-stone-100 p-2 text-xs">
                    <div className="font-medium">今日新增 3 位族人</div>
                    <div className="text-[10px] text-stone-500">王明华 / 王诗雨 / 王远舟</div>
                  </div>
                  <div className="rounded-lg bg-stone-100 p-2 text-xs">
                    <div className="font-medium">族中长辈寿辰提醒</div>
                    <div className="text-[10px] text-stone-500">王老（85 岁）下周三</div>
                  </div>
                  <div className="rounded-lg bg-rose-700/10 p-2 text-xs text-rose-800">
                    <div className="font-medium">春节祭祖 · 倒计时 23 天</div>
                  </div>
                </div>
                <div className="flex justify-around border-t border-stone-200 py-2 text-[10px] text-stone-500">
                  <span>谱</span>
                  <span>族</span>
                  <span>我</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <SectionEyebrow>移动端 · 小程序</SectionEyebrow>
            <SectionTitle>春节前，把整本家谱装进微信。</SectionTitle>
            <p className="mt-4 text-base leading-relaxed text-stone-700 dark:text-stone-300">
              微信小程序计划 <strong>2026 春节前公测</strong>。我们正在把网页端核心能力——关系树、吊线古谱、邀请扫码——
              在小程序里重做一遍，并加上专为手机场景设计的玩法：
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-stone-700 dark:text-stone-300 sm:grid-cols-2">
              <Mp text="📲 微信扫一扫即加入家族" />
              <Mp text="🎴 节日定制二维码海报" />
              <Mp text="👤 长辈寿辰自动提醒" />
              <Mp text="📍 LBS 同城族人雷达" />
              <Mp text="🎤 长辈口述录入 + 转写" />
              <Mp text="🎁 春运红包" />
            </ul>

            <p className="mt-5 text-xs text-stone-500">
              注册后一旦小程序上线，第一时间通过短信通知你（不发广告）。
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <PrimaryCTA href="/register" variant="vermilion">
                注册 → 抢小程序内测
              </PrimaryCTA>
            </div>
          </div>
        </div>
      </section>

      {/* ───── 同姓寻根 ───── */}
      <section
        id="root"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="rounded-3xl border border-rose-700/20 bg-[radial-gradient(80%_120%_at_30%_30%,rgba(168,32,31,0.08),transparent)] p-10 dark:border-rose-400/20 sm:p-14">
          <SectionEyebrow>同姓寻根</SectionEyebrow>
          <SectionTitle>失散两百年的一支，可能就在隔壁省。</SectionTitle>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-stone-700 dark:text-stone-300">
            按姓氏 + 祖籍地 + 字辈表三维匹配，系统会在你的家谱里找出可能同源的其它家族。
            两边族长可以加微信、互看公开支系、合修跨族大谱。
            这是数字时代专属的「认祖归宗」——不需要花十年走遍全国，几次点击就够了。
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            <RootMatch tag="高度可能" name="湖南益阳张氏" detail="祖籍江西吉水 · 字辈「国正天心顺」前 5 字一致" />
            <RootMatch tag="可能" name="四川泸州张氏" detail="祖籍江西吉水 · 字辈前 3 字一致 · 迁徙年代符合" />
            <RootMatch tag="待核验" name="台湾高雄张氏" detail="祖籍湖广 · 字辈差异大但堂号相同" />
          </div>

          <p className="mt-6 text-xs text-stone-500">
            ※ 仅向族长展示匹配候选，并需双方同意才能互看支系。隐私优先。
          </p>
        </div>
      </section>

      {/* ───── 路线图 ───── */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <SectionEyebrow>
            <span className="mx-auto">路线图</span>
          </SectionEyebrow>
          <SectionTitle align="center">未来 12 个月，我们会做这些。</SectionTitle>
        </div>

        <ol className="mt-12 space-y-6">
          {ROADMAP.map((r, i) => (
            <Roadmap key={i} {...r} />
          ))}
        </ol>
      </section>

      {/* ───── 数据安全 ───── */}
      <section
        id="security"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="max-w-2xl">
          <SectionEyebrow>数据安全</SectionEyebrow>
          <SectionTitle>家谱不是社交内容，安全是底线。</SectionTitle>
          <p className="mt-4 text-base leading-relaxed text-stone-700 dark:text-stone-300">
            族谱·家不卖你的家族数据，不投放族人 ID 给广告主，所有商业模式来自你支付的订阅费用。
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Security
            title="数据归你"
            desc="任何时候一键导出 JSON / GEDCOM。我们只是托管者。"
          />
          <Security
            title="多重备份"
            desc="多可用区主从 + 每日加密备份 + 30 天异地副本。"
          />
          <Security
            title="审计日志"
            desc="所有写操作 before/after 可追溯，永久珍藏版永久保留。"
          />
          <Security
            title="默认私密"
            desc="未授权用户看不到任何字段。族谱不是公开数据。"
          />
        </div>

        <div className="mt-8 rounded-xl border border-stone-200 bg-white/70 p-6 text-sm leading-relaxed text-stone-700 dark:border-stone-800 dark:bg-stone-900/50 dark:text-stone-300">
          <strong className="text-stone-900 dark:text-stone-50">承诺：</strong>{" "}
          我们永远不会把你家族的数据用于训练公开模型、推送广告、或转售给第三方机构。
          如发生数据泄露事件，我们将在 72 小时内通过短信和站内公告告知所有受影响的族长。
          此承诺写入服务协议，违反则按月度订阅费的 10 倍赔偿。
        </div>
      </section>

      {/* ───── 演示 ───── */}
      <section
        id="demo"
        className="mx-auto max-w-4xl scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 text-center"
      >
        <SectionEyebrow>
          <span className="mx-auto">先看演示</span>
        </SectionEyebrow>
        <SectionTitle align="center">还在犹豫？先看一份真实家谱。</SectionTitle>
        <p className="mx-auto mt-5 max-w-xl text-base text-stone-700 dark:text-stone-300">
          我们准备了一个 5 代 38 人的演示家族，你可以直接体验关系树、吊线古谱、字辈、迁徙地图、册谱 PDF 等所有核心功能——无需注册。
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <PrimaryCTA href="/share/demo" variant="vermilion">
            进入演示家族 →
          </PrimaryCTA>
          <SecondaryCTA href="/register">直接免费注册</SecondaryCTA>
        </div>
      </section>

      {/* ───── 终 ───── */}
      <section className="mx-auto max-w-4xl px-4 pb-24 text-center sm:px-6 lg:px-8">
        <Divider label="终" />
        <Quote source="《孟子·梁惠王上》">老吾老以及人之老，幼吾幼以及人之幼。</Quote>
        <p className="mx-auto mt-6 max-w-xl text-base text-stone-700 dark:text-stone-300">
          愿这个平台陪你和你家族走过每一个春节、每一次清明、每一场祭祖。
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <PrimaryCTA href="/register" variant="vermilion">
            免费开始建谱 →
          </PrimaryCTA>
          <Link
            href="/pricing"
            className="text-sm text-stone-600 hover:text-rose-700 dark:text-stone-400 dark:hover:text-rose-400"
          >
            查看价格 →
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </PaperBackdrop>
  );
}

/* ─────────── 子组件 ─────────── */

function ViralCard({
  badge,
  title,
  desc,
  cta,
  on,
  highlight,
}: {
  badge: string;
  title: string;
  desc: string;
  cta: string;
  on?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex h-full flex-col rounded-xl border p-6 transition hover:-translate-y-0.5 hover:shadow-md ${
        highlight
          ? "border-rose-700/40 bg-rose-700/[0.04] dark:border-rose-400/40 dark:bg-rose-400/[0.06]"
          : "border-stone-200 bg-white/70 dark:border-stone-800 dark:bg-stone-900/50"
      }`}
    >
      <div className="text-xs font-medium tracking-wider text-rose-700 dark:text-rose-400">
        {badge}
      </div>
      <h3 className="mt-3 font-serif text-lg font-semibold text-stone-900 dark:text-stone-50">
        {title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
        {desc}
      </p>
      <div className="mt-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            on
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-stone-400"}`} />
          {cta}
        </span>
      </div>
    </div>
  );
}

function Mp({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-stone-200 bg-white/60 px-3 py-2 dark:border-stone-800 dark:bg-stone-900/40">
      {text}
    </li>
  );
}

function RootMatch({ tag, name, detail }: { tag: string; name: string; detail: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/70 p-5 dark:border-stone-800 dark:bg-stone-900/50">
      <span className="rounded-full bg-rose-700/15 px-2 py-0.5 text-[10px] font-medium tracking-wide text-rose-800 dark:bg-rose-400/15 dark:text-rose-300">
        {tag}
      </span>
      <h4 className="mt-3 font-serif text-base font-semibold text-stone-900 dark:text-stone-50">
        {name}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
        {detail}
      </p>
    </div>
  );
}

function Roadmap({
  quarter,
  title,
  desc,
  status,
}: {
  quarter: string;
  title: string;
  desc: string;
  status: "shipped" | "now" | "next";
}) {
  const dot =
    status === "shipped"
      ? "bg-emerald-500"
      : status === "now"
        ? "bg-rose-700 animate-pulse dark:bg-rose-400"
        : "bg-stone-400";
  const tag =
    status === "shipped"
      ? "已交付"
      : status === "now"
        ? "进行中"
        : "下季度";
  return (
    <li className="relative flex gap-5 pl-6">
      <span className={`absolute left-0 top-2.5 h-3 w-3 rounded-full ${dot}`} />
      <span className="absolute left-1.5 top-5 bottom-0 w-px bg-stone-200 dark:bg-stone-800" />
      <div className="flex-1 rounded-xl border border-stone-200 bg-white/70 p-5 dark:border-stone-800 dark:bg-stone-900/50">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-serif text-xs tracking-wider text-stone-500">{quarter}</div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              status === "shipped"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                : status === "now"
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                  : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300"
            }`}
          >
            {tag}
          </span>
        </div>
        <h4 className="mt-1 font-serif text-lg font-semibold text-stone-900 dark:text-stone-50">
          {title}
        </h4>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          {desc}
        </p>
      </div>
    </li>
  );
}

function Security({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/70 p-5 dark:border-stone-800 dark:bg-stone-900/50">
      <h3 className="font-serif text-base font-semibold text-stone-900 dark:text-stone-50">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
        {desc}
      </p>
    </div>
  );
}

/* ─────────── 数据 ─────────── */

const ROADMAP: {
  quarter: string;
  title: string;
  desc: string;
  status: "shipped" | "now" | "next";
}[] = [
  {
    quarter: "2025 Q4",
    title: "Web 一期 · 核心建模",
    desc: "关系树、吊线古谱、字辈支系、邀请系统、邮件登录、Excel 导入、JSON / CSV / GEDCOM 导出。",
    status: "shipped",
  },
  {
    quarter: "2026 Q1",
    title: "微信小程序公测",
    desc: "扫一扫加入、节日海报、长辈寿辰提醒、LBS 同城族人雷达、长辈口述录入。",
    status: "now",
  },
  {
    quarter: "2026 Q1",
    title: "册谱 PDF 印刷服务",
    desc: "线装古风 / 现代精装两种装帧，全国包邮；可定制扉页、序言、字辈表。",
    status: "now",
  },
  {
    quarter: "2026 Q2",
    title: "同姓寻根 · 跨族匹配",
    desc: "按姓氏 + 祖籍 + 字辈三维匹配同源家族；族长间隐私握手协议。",
    status: "next",
  },
  {
    quarter: "2026 Q2",
    title: "抖音 / 小红书 寻根投稿",
    desc: "自动生成家族故事短视频模板，发到内容平台，吸引失散族人主动认亲。",
    status: "next",
  },
  {
    quarter: "2026 Q3",
    title: "AI 辅助续谱（OCR）",
    desc: "上传老家谱扫描页 / 照片，自动识别人物、关系、字辈、配偶、生卒，转为结构化数据。",
    status: "next",
  },
  {
    quarter: "2026 Q4",
    title: "家族纪录片工具",
    desc: "自动生成 3–5 分钟家族迁徙史短片，可投影于祭祖大屏。",
    status: "next",
  },
  {
    quarter: "2027 H1",
    title: "私有部署 / 自托管版",
    desc: "为大型宗祠提供 Docker / Helm 安装包，数据完全在你自己的服务器上。",
    status: "next",
  },
];
