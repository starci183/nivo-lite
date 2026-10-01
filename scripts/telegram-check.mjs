#!/usr/bin/env node
// Smoke test of the real Telegram channel: with the owner's saved Telegram Web session, message the NIVO bot and wait
// for the Chatbot AI's reply. Only ever messages the bot. Usage: node scripts/telegram-check.mjs "<text>" [shot.png]
import { chromium } from "playwright";

const text = process.argv[2] ?? "Xin chào";
const shot = process.argv[3] ?? "D:/starci-lanes/.deploy/telegram-check.png";
const BOT = process.env.TELEGRAM_BOT_USERNAME || "nivo_demo_bot";
const ctx = await chromium.launchPersistentContext("D:/starci-lanes/.telegram-profile", { headless: true, viewport: { width: 420, height: 860 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());
// Phone-width view opened straight on the bot chat, so the owner's personal chat list never shows.
await page.goto("https://web.telegram.org/a/#?tgaddr=" + encodeURIComponent(`tg://resolve?domain=${BOT}`), { waitUntil: "domcontentloaded" });
const input = page.locator("#editable-message-text");
const start = page.getByRole("button", { name: /^(Start|Bắt đầu)$/i });
// A fresh bot chat shows a "Start" button instead of the composer.
await input.or(start).first().waitFor({ state: "visible", timeout: 60_000 });
if (await start.isVisible().catch(() => false)) { await start.click(); await page.waitForTimeout(4000); }
await input.waitFor({ state: "visible", timeout: 30_000 });
const bubbles = page.locator(".message-list-item .text-content");
const before = await bubbles.count();
await input.click();
await page.keyboard.type(text, { delay: 20 });
await page.keyboard.press("Enter");
const deadline = Date.now() + 60_000;
let reply = null;
while (Date.now() < deadline) {
  const n = await bubbles.count();
  if (n >= before + 2) {
    const last = bubbles.last();
    const isIncoming = await last.evaluate((el) => !el.closest(".message-list-item")?.classList.contains("own"));
    if (isIncoming) { reply = (await last.innerText()).trim(); break; }
  }
  await page.waitForTimeout(1000);
}
await page.screenshot({ path: shot });
console.log(reply ? `REPLY: ${reply.slice(0, 300)}` : "NO REPLY within 60s");
await ctx.close();
