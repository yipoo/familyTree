/**
 * 反闪烁脚本：根据 cookie / localStorage / 系统偏好把 <html class="dark">
 * 与 color-scheme 设到位。脚本体在 public/theme-init.js（静态文件）。
 *
 * 为什么不 inline / 不 dangerouslySetInnerHTML / 不 next/script + beforeInteractive：
 * React 19 对 JSX 中的 <script> 元素只在 `async + src（无 onLoad/onError、
 * 无 dangerouslySetInnerHTML）` 这一种情况下视为 Resource、不报告警。
 * 其他写法都会触发 "Encountered a script tag while rendering React component"。
 *
 * 副作用：async 不再 parse-blocking，第一次访问且 system=dark / 无 cookie 的
 * 用户可能看到一瞬亮屏；已有 cookie 的回访用户与 system=light 用户无感。
 *
 * 同步约定：public/theme-init.js 里的 key/cookieKey 必须与
 * components/layout/theme.ts 的 THEME_STORAGE_KEY / THEME_COOKIE 一致。
 */
export function ThemeScript() {
  return <script async src="/theme-init.js" />;
}
