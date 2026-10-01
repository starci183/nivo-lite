#!/usr/bin/env node
// Screenshot app routes as the local demo user.
// Usage: node scripts/shot.mjs <outDir> <path> [path...]   e.g. node scripts/shot.mjs ../../.shots/a2 / /responsibilities
// Env: SHOT_WIDTH (1440), SHOT_HEIGHT (900), SHOT_FULL=1 for full-page, BASE_URL (http://localhost:3100)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const [outDir, ...paths] = process.argv.slice(2);
if (!outDir || !paths.length) {
  console.error("usage: node scripts/shot.mjs <outDir> <path> [path...]");
  process.exit(1);
}
const base = process.env.BASE_URL || "http://localhost:3100";
const width = Number(process.env.SHOT_WIDTH || 1440);
const height = Number(process.env.SHOT_HEIGHT || 900);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
if (process.env.SHOT_LOCALE) {
  await context.addCookies([{ name: "NIVO_LOCALE", value: process.env.SHOT_LOCALE, url: base }]);
}
const page = await context.newPage();
await page.goto(`${base}/login`);
await page.locator("nextjs-portal").evaluateAll((els) => els.forEach((e) => e.remove())).catch(() => {});
await page.getByRole("button", { name: /Dùng thử ngay|Try NIVO now|demo/i }).first().click({ force: true });
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });

for (const p of paths) {
  await page.goto(`${base}${p}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const file = join(outDir, `${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}.png`);
  await page.screenshot({ path: file, fullPage: process.env.SHOT_FULL === "1" });
  console.log(file);
}
await browser.close();
