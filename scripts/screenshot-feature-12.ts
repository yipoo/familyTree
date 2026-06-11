/**
 * Feature 12: 树谱三件套（间距档位 / 筛选 / 滚轮模式）截图
 *
 * 用法：
 *   pnpm tsx scripts/screenshot-feature-12.ts
 *
 * 前提：本机 Postgres 已导入丁氏家族；已 `pnpm build && next start -p 3010`
 *
 * 输出：docs/ui-screenshots/feature-12-{spacing-compact,filter-popover,scroll-mode-scroll}.png
 */
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";

import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3010";
const PHONE = "13800138000";
const PASSWORD = "111111";
const FAMILY_ID = "cmol9qaxz0001mi2foautenf3";

const OUT_DIR = path.resolve(process.cwd(), "docs/ui-screenshots");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const VP = { width: 1440, height: 900 };

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="identifier"], input[name="phone"]').first().fill(PHONE);
  await page.locator('input[name="password"]').first().fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/\/dashboard$|\/$/, { timeout: 15_000 }),
    page.locator('button[type="submit"]').first().click(),
  ]);
}

async function gotoTree(page: Page) {
  await page.goto(`${BASE}/f/${FAMILY_ID}/tree`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
  // 等 xy-flow 节点出现
  await page.locator(".react-flow__node").first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
}

async function snap(page: Page, file: string) {
  await page.screenshot({ path: file, fullPage: false });
  // eslint-disable-next-line no-console
  console.log(`  ✓ ${path.relative(process.cwd(), file)}`);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: VP,
    deviceScaleFactor: 2,
    locale: "zh-CN",
    colorScheme: "light",
  });
  // 默认浅色主题
  await ctx.addCookies([
    {
      name: "zupu-theme",
      value: "light",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  const page = await ctx.newPage();
  await login(page);

  // 1) 间距 = 紧凑
  await gotoTree(page);
  await page.getByRole("button", { name: "紧凑" }).click();
  // 重新拉取与渲染
  await page.waitForTimeout(1500);
  await page.locator(".react-flow__node").first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  await snap(page, path.join(OUT_DIR, "feature-12-spacing-compact.png"));

  // 2) 筛选 popover 打开
  await gotoTree(page);
  await page.getByRole("button", { name: /^筛选/ }).first().click();
  // 等待选项加载
  await page.waitForTimeout(1500);
  await snap(page, path.join(OUT_DIR, "feature-12-filter-popover.png"));

  // 3) 滚轮模式切到 "滚动"
  await gotoTree(page);
  // 默认按钮文案是 "滚轮：缩放"，点击切换
  await page.getByRole("button", { name: /滚轮[:：]\s*缩放/ }).click();
  await page.waitForTimeout(500);
  await snap(page, path.join(OUT_DIR, "feature-12-scroll-mode-scroll.png"));

  await ctx.close();
  await browser.close();
  // eslint-disable-next-line no-console
  console.log(`\n完成。输出目录：${OUT_DIR}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
