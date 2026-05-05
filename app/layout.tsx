import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { ThemeScript } from "@/components/layout/ThemeScript";
import { TopNav } from "@/components/layout/TopNav";
import { THEME_COOKIE, isTheme } from "@/components/layout/theme";

import "./globals.css";

/**
 * 字体策略：完全采用系统字体栈（Inter / -apple-system + PingFang SC /
 * Source Han Sans SC + Songti SC for serif）。
 *
 * 改动原因：
 * 1. 用户规范明确要求"中文用 PingFang SC / Source Han Sans，英文用 Inter"
 * 2. 跳过 next/font/google 的运行时下载，构建更稳、首屏更快、不受网络限制
 * 3. 保留 CSS 变量名 --font-geist-sans / --font-geist-mono / --font-noto-serif-sc
 *    向下兼容（globals.css 已经把它们映射到系统栈）
 */

export const metadata: Metadata = {
  metadataBase: new URL("https://zupu.app"),
  title: {
    default: "族谱·家 — 把家族的故事，刻进时间",
    template: "%s · 族谱·家",
  },
  description:
    "为中国家族打造的现代化家谱平台。支持关系树、吊线古谱、字辈支系、嫁入嫁出、居住地继承、子树管理员、册谱 PDF 导出、Excel 批量导入、GEDCOM 国际通用导出。50 人以下永久免费。",
  keywords: [
    "家谱",
    "族谱",
    "宗谱",
    "字辈",
    "支系",
    "修谱",
    "电子家谱",
    "在线家谱",
    "GEDCOM",
    "册谱",
    "祠堂",
    "寻根",
  ],
  openGraph: {
    type: "website",
    locale: "zh_CN",
    title: "族谱·家 — 把家族的故事，刻进时间",
    description:
      "为中国家族打造的现代化家谱平台。关系树、吊线古谱、字辈支系、册谱 PDF 导出，全族成员一起编修。",
    siteName: "族谱·家",
  },
  twitter: {
    card: "summary_large_image",
    title: "族谱·家",
    description: "为中国家族打造的现代化家谱平台",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // SSR 读 cookie 决定首屏 dark class，避免主题闪烁
  // —— 'system' 时拿不到客户端 prefers-color-scheme，由 ThemeScript inline 同步覆盖
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value;
  const initialTheme = isTheme(themeCookie) ? themeCookie : "system";
  const initialResolved = initialTheme === "dark" ? "dark" : "light";

  return (
    <html
      lang="zh-CN"
      data-theme={initialTheme}
      data-resolved-theme={initialResolved}
      className={`h-full antialiased ${initialResolved === "dark" ? "dark" : ""}`}
      style={{ colorScheme: initialResolved }}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppShell>
          <Suspense fallback={null}>
            <TopNav />
          </Suspense>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
