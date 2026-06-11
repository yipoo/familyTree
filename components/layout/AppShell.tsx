/**
 * AppShell：页面整体 background + 全局 ThemeProvider 包裹。
 *
 * 与 RootLayout 配合使用：RootLayout 注入 ThemeScript（消闪烁）+ TopNav，
 * 此处提供 ThemeProvider 给所有客户端子树拿到 setTheme。
 */

"use client";

import { ThemeProvider } from "./ThemeProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
