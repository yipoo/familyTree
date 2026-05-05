import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC } from "next/font/google";
import { Suspense } from "react";

import { TopNav } from "@/components/TopNav";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSerifSC.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <TopNav />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
