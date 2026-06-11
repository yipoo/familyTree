"use client";

/**
 * 客户端轻量主题上下文。
 *
 * - 状态：'light' | 'dark' | 'system'
 * - 写入：localStorage + cookie（cookie 让 server 端可读，避免下次 SSR 闪烁）
 * - 监听 prefers-color-scheme 变更，仅在 'system' 模式下生效
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  THEME_COOKIE,
  THEME_STORAGE_KEY,
  type Theme,
  isTheme,
} from "./theme";

interface ThemeContextValue {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitial(): Theme {
  if (typeof document === "undefined") return "system";
  const attr = document.documentElement.getAttribute("data-theme");
  return isTheme(attr) ? (attr as Theme) : "system";
}

function readResolved(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 第一渲染必须与 ThemeScript 同步——读 dom，避免 hydration 错位
  const [theme, setThemeState] = useState<Theme>(readInitial);
  const [resolved, setResolved] = useState<"light" | "dark">(readResolved);

  const apply = useCallback((t: Theme) => {
    const next: "light" | "dark" =
      t === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : t;
    const html = document.documentElement;
    html.classList.add("theme-transition");
    html.classList.toggle("dark", next === "dark");
    html.style.colorScheme = next;
    html.setAttribute("data-theme", t);
    html.setAttribute("data-resolved-theme", next);
    setResolved(next);
    // 清除 transition 标记，避免初次进站的微闪
    window.setTimeout(() => html.classList.remove("theme-transition"), 240);
  }, []);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, t);
      } catch {
        /* ignore */
      }
      // cookie 让 server 端在下次 SSR 直接拿到正确值
      const oneYear = 60 * 60 * 24 * 365;
      document.cookie = `${THEME_COOKIE}=${encodeURIComponent(
        t,
      )}; path=/; max-age=${oneYear}; SameSite=Lax`;
      apply(t);
    },
    [apply],
  );

  // 监听系统偏好——仅 'system' 模式生效
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme === "system") apply("system");
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme, apply]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // 回退（极端情况下被脱离 Provider 渲染时）：空操作
    return {
      theme: "system",
      resolved: "light",
      setTheme: () => {},
    };
  }
  return ctx;
}
