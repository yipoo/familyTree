import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="mt-24 border-t border-stone-200 bg-stone-50/60 py-12 dark:border-stone-800 dark:bg-stone-950/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-rose-700 font-serif text-xs font-bold text-rose-50"
            >
              族
            </span>
            <span className="font-serif text-base font-semibold text-stone-900 dark:text-stone-50">
              族谱·家
            </span>
          </div>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-stone-500 dark:text-stone-400">
            把家族的故事，刻进时间。<br />
            为中国式家谱设计的现代化协作平台。
          </p>
        </div>

        <FooterCol
          title="产品"
          items={[
            { label: "功能详解", href: "/features" },
            { label: "价格", href: "/pricing" },
            { label: "演示家族", href: "/about#demo" },
            { label: "登录 / 注册", href: "/register" },
          ]}
        />
        <FooterCol
          title="社区"
          items={[
            { label: "故事 & 愿景", href: "/about" },
            { label: "病毒邀请计划", href: "/about#invite" },
            { label: "小程序进度", href: "/about#mp" },
            { label: "同姓寻根", href: "/about#root" },
          ]}
        />
        <FooterCol
          title="支持"
          items={[
            { label: "FAQ", href: "/pricing#faq" },
            { label: "数据安全", href: "/about#security" },
            { label: "导出与备份", href: "/features#export" },
            { label: "联系客服", href: "mailto:hello@zupu.app" },
          ]}
        />
      </div>

      <div className="mx-auto mt-10 flex max-w-6xl flex-col items-center gap-2 border-t border-stone-200 px-4 pt-6 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-500 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} 族谱·家 / zupu.app · 保留族中所有故事</p>
        <p className="font-serif italic">慎终追远，民德归厚矣。</p>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold tracking-wider text-stone-500 uppercase">
        {title}
      </h4>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-stone-700 transition hover:text-rose-700 dark:text-stone-300 dark:hover:text-rose-400"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
