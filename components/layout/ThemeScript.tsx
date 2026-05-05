/**
 * SSR 注入到 <head> 的内联脚本：在第一帧前同步根据 cookie / localStorage / 系统偏好
 * 设置 <html class="dark"> 与 color-scheme，彻底消除主题闪烁。
 *
 * 不能改成模块化 / 不能 await——必须 inline blocking。
 */
import { THEME_COOKIE, THEME_STORAGE_KEY } from "./theme";

const SCRIPT = `(() => {
  try {
    var key = ${JSON.stringify(THEME_STORAGE_KEY)};
    var cookieKey = ${JSON.stringify(THEME_COOKIE)};
    var stored = null;
    try { stored = localStorage.getItem(key); } catch (_) {}
    if (!stored) {
      var match = document.cookie.match(new RegExp('(?:^|; )' + cookieKey + '=([^;]+)'));
      if (match) stored = decodeURIComponent(match[1]);
    }
    var t = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var resolved = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t;
    var html = document.documentElement;
    html.classList.toggle('dark', resolved === 'dark');
    html.style.colorScheme = resolved;
    html.setAttribute('data-theme', t);
    html.setAttribute('data-resolved-theme', resolved);
  } catch (_) {}
})();`;

export function ThemeScript() {
  return (
    <script
      // 必须 inline 在 <head>，且不能 type=module
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  );
}
