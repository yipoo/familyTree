/**
 * 真实数据 UI 截图脚本
 *
 * 用法：
 *   pnpm tsx scripts/screenshot-ui.ts
 *
 * 前提：
 *   - 本机 Postgres 已导入丁氏家族数据
 *   - 已 `pnpm build && next start -p 3010`
 *   - SUPERADMIN 账号：手机号 13800138000 / 密码 111111
 *
 * 输出：
 *   docs/ui-screenshots/<page>-<viewport>-<theme>.png
 */
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";

import { chromium, type BrowserContext, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3010";
const PHONE = "13800138000";
const PASSWORD = "111111";

const FAMILY_ID = "cmol9qaxz0001mi2foautenf3";
const PERSON_ID = "cmol9qb10003ami2frnjm8tpn"; // 尚偉，9 代，有父母 / 配偶 / 子女

const OUT_DIR = path.resolve(process.cwd(), "docs/ui-screenshots");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

type Viewport = { name: "desktop" | "mobile"; width: number; height: number };
type Theme = "light" | "dark";

const VIEWPORTS: Viewport[] = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 375, height: 812 },
];

const THEMES: Theme[] = ["light", "dark"];

/**
 * heavy=true 的页面在真实数据上会渲染超长 DOM（10k+ 人物），
 * fullPage 截图会触发 Chromium tile 内存上限并崩溃。
 * 所以这些页面只截「顶栏 + 前 ~3 屏」，足以展示设计语言。
 */
const PAGES: {
  slug: string;
  path: string;
  heavy?: boolean;
  isTreeView?: boolean;
}[] = [
  { slug: "02-dashboard", path: "/" },
  { slug: "03-me", path: "/me" },
  { slug: "04-family-overview", path: `/f/${FAMILY_ID}`, heavy: true },
  { slug: "05-tree", path: `/f/${FAMILY_ID}/tree`, isTreeView: true },
  { slug: "06-table", path: `/f/${FAMILY_ID}/table`, heavy: true },
  { slug: "07-lineage", path: `/f/${FAMILY_ID}/lineage`, isTreeView: true },
  { slug: "08-album", path: `/f/${FAMILY_ID}/album`, heavy: true },
  { slug: "09-search", path: `/f/${FAMILY_ID}/search` },
  { slug: "10-person-detail", path: `/f/${FAMILY_ID}/p/${PERSON_ID}` },
  { slug: "11-admin-audit", path: `/f/${FAMILY_ID}/admin/audit` },
];

function fileFor(slug: string, vp: Viewport, theme: Theme) {
  return path.join(OUT_DIR, `${slug}-${vp.name}-${theme}.png`);
}

async function setTheme(ctx: BrowserContext, theme: Theme) {
  await ctx.addCookies([
    {
      name: "zupu-theme",
      value: theme,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="identifier"], input[name="phone"]').first().fill(PHONE);
  await page.locator('input[name="password"]').first().fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/\/dashboard$|\/$/, { timeout: 15_000 }),
    page.locator('button[type="submit"]').first().click(),
  ]);
}

async function snap(
  page: Page,
  file: string,
  vp: Viewport,
  opts: { heavy?: boolean; isTreeView?: boolean } = {},
) {
  // 等动画 / 字体 / xy-flow 节点稳定
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(550);

  if (opts.heavy) {
    // 渲染长度被人为裁剪到 ~3 屏，避免 Chromium tile 内存崩溃。
    const clipHeight = vp.height * 3;
    await page.screenshot({
      path: file,
      clip: { x: 0, y: 0, width: vp.width, height: clipHeight },
    });
  } else if (opts.isTreeView) {
    // 树 / 吊线图：xy-flow 容器是 100vh，没有滚动条，fullPage 等价于视口截图
    await page.screenshot({ path: file, fullPage: false });
  } else {
    await page.screenshot({ path: file, fullPage: true });
  }
  // eslint-disable-next-line no-console
  console.log(`  ✓ ${path.relative(process.cwd(), file)}`);
}

async function runOne(vp: Viewport, theme: Theme) {
  // eslint-disable-next-line no-console
  console.log(`\n>>> ${vp.name} ${vp.width}×${vp.height} · ${theme}`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    locale: "zh-CN",
    colorScheme: theme, // 让 prefers-color-scheme 也对齐主题
  });
  await setTheme(ctx, theme);
  const page = await ctx.newPage();

  // 登录前：截 /login
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(350);
  await page.screenshot({
    path: fileFor("01-login", vp, theme),
    fullPage: true,
  });
  // eslint-disable-next-line no-console
  console.log(`  ✓ 01-login`);

  // 登录
  await login(page);

  for (const p of PAGES) {
    try {
      await page.goto(`${BASE}${p.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await snap(page, fileFor(p.slug, vp, theme), vp, {
        heavy: p.heavy,
        isTreeView: p.isTreeView,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`  ✗ ${p.slug} 失败: ${(e as Error).message}`);
    }
  }

  await ctx.close();
  await browser.close();
}

async function main() {
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      await runOne(vp, theme);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`\n全部完成。输出目录：${OUT_DIR}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
