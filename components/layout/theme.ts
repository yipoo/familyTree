/**
 * 主题相关共享常量与帮助函数。
 *
 * 设计：
 * - 三态：'light' | 'dark' | 'system'，cookie + localStorage 都存原始三态
 * - 应用 class 时：'system' 解析为 prefers-color-scheme 的当前值
 * - 服务端可读 cookie 决定 SSR class，避免无意义闪烁
 */

export type Theme = "light" | "dark" | "system";

// 反闪烁脚本（public/theme-init.js）里硬编码了同样的值——若改这两个常量，
// 必须同步改 public/theme-init.js 里的 key / cookieKey。
export const THEME_COOKIE = "zupu-theme";
export const THEME_STORAGE_KEY = "zupu-theme";
export const THEME_VALUES: readonly Theme[] = [
  "light",
  "dark",
  "system",
] as const;

export function isTheme(v: unknown): v is Theme {
  return v === "light" || v === "dark" || v === "system";
}

export function resolveTheme(t: Theme): "light" | "dark" {
  if (t === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return t;
}
