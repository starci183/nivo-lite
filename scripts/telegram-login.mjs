#!/usr/bin/env node
// Open Telegram Web in a visible Chromium window with a persistent profile so the owner can scan the login QR themselves.
// The session is kept in D:/starci-lanes/.telegram-profile for later headless recordings. Saves the QR as a PNG too.
// Usage: node scripts/telegram-login.mjs
import { chromium } from "playwright";
const profile = "D:/starci-lanes/.telegram-profile";
const qrFile = "D:/starci-lanes/.deploy/telegram-qr.png";
const ctx = await chromium.launchPersistentContext(profile, { headless: false, viewport: { width: 1200, height: 860 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto("https://web.telegram.org/a/", { waitUntil: "domcontentloaded" });
const deadline = Date.now() + 15 * 60_000;
while (Date.now() < deadline) {
  // Logged in once the chat list is there.
  if (await page.locator("#LeftColumn .chat-list, .chat-list, [class*='ChatList']").first().isVisible().catch(() => false)) {
    console.log("LOGGED_IN");
    await page.waitForTimeout(4000);
    await ctx.close();
    process.exit(0);
  }
  const qr = page.locator("canvas, .qr-container, [class*='qr']").first();
  if (await qr.isVisible().catch(() => false)) await page.screenshot({ path: qrFile }).catch(() => {});
  await page.waitForTimeout(3000);
}
console.log("TIMEOUT");
await ctx.close();
