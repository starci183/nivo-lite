#!/usr/bin/env node
// Headless UAT of the customer journey with video recording (one .webm per scene) and a pass/fail report.
// Usage: node scripts/uat-video.mjs <outDir>      Env: BASE_URL (https://nivo.vn), UAT_LOCALE (vi)
// Non-destructive on the shared demo workspace: it never approves/rejects; it only asks @sales one question.
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: node scripts/uat-video.mjs <outDir>");
  process.exit(1);
}
const base = process.env.BASE_URL || "https://nivo.vn";
const locale = process.env.UAT_LOCALE || "vi";
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
mkdirSync(outDir, { recursive: true });

// A visible cursor + click ripple, because headless video has no pointer.
const CURSOR = () => {
  const install = () => {
    if (document.getElementById("__uat_cursor")) return;
    const c = document.createElement("div");
    c.id = "__uat_cursor";
    c.style.cssText = "position:fixed;left:-40px;top:-40px;width:22px;height:22px;z-index:2147483647;pointer-events:none;transition:transform .08s;background:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M3 2l7 19 2.5-7.5L20 11z' fill='%23111' stroke='white' stroke-width='1.5'/></svg>\") no-repeat;";
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX - 3 + "px"; c.style.top = e.clientY - 2 + "px"; }, true);
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      r.style.cssText = `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;border:3px solid #E11D48;z-index:2147483646;pointer-events:none;transition:all .5s ease-out;opacity:.9`;
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = "scale(1.8)"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
};

const results = [];
const check = async (scene, name, fn) => {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ scene, name, ok: true, ms: Date.now() - t0 });
    console.log(`  PASS ${name}`);
  } catch (e) {
    results.push({ scene, name, ok: false, ms: Date.now() - t0, error: String(e.message || e).split("\n")[0] });
    console.log(`  FAIL ${name}: ${String(e.message || e).split("\n")[0]}`);
  }
};

const browser = await chromium.launch();
let storageState;

/** Run one scene in a fresh recorded context; the video is renamed to <nn>-<id>.webm. */
const scene = async (nn, id, viewport, body) => {
  console.log(`scene ${nn} ${id}`);
  const context = await browser.newContext({
    viewport, deviceScaleFactor: 1, storageState, locale: locale === "vi" ? "vi-VN" : "en-US",
    recordVideo: { dir: outDir, size: viewport },
    ...(viewport.width < 768 ? { isMobile: true, hasTouch: false } : {})
  });
  await context.addCookies([{ name: "NIVO_LOCALE", value: locale, url: base }]);
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  const mouse = { x: viewport.width / 2, y: viewport.height / 2 };
  const moveTo = async (locator) => {
    await locator.scrollIntoViewIfNeeded();
    const b = await locator.boundingBox();
    if (!b) throw new Error("element not visible");
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y, { steps: 25 });
    mouse.x = x; mouse.y = y;
    await page.waitForTimeout(250);
  };
  const click = async (locator) => { await moveTo(locator); await page.mouse.down(); await page.mouse.up(); };
  const pause = (ms = 1500) => page.waitForTimeout(ms);
  const smoothScroll = async (px, steps = 12) => { for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, px / steps); await page.waitForTimeout(60); } };
  try {
    await body({ page, click, moveTo, pause, smoothScroll, check: (name, fn) => check(id, name, fn) });
  } catch (e) {
    results.push({ scene: id, name: "scene crashed", ok: false, error: String(e.message || e).split("\n")[0] });
    console.log(`  CRASH ${e.message}`);
  }
  if (id === "login") storageState = await context.storageState();
  const video = page.video();
  await context.close();
  if (video) renameSync(await video.path(), join(outDir, `${nn}-${id}.webm`));
};

// 1. Landing page — what a visitor sees first.
await scene("01", "landing", DESKTOP, async ({ page, pause, smoothScroll, check }) => {
  await check("landing loads (200)", async () => {
    const r = await page.goto(base + "/", { waitUntil: "networkidle" });
    if (!r || r.status() !== 200) throw new Error(`status ${r?.status()}`);
  });
  await pause(2500);
  for (let i = 0; i < 5; i++) { await smoothScroll(700); await pause(1300); }
  await check("landing has a call to action", async () => {
    if ((await page.getByRole("link").count()) < 3) throw new Error("too few links");
  });
});

// 2. Login with the demo account.
await scene("02", "login", DESKTOP, async ({ page, click, pause, check }) => {
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  await pause(1500);
  await check("demo login lands on the dashboard", async () => {
    await click(page.getByRole("button", { name: /Dùng thử ngay|Try NIVO now|demo/i }).first());
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  });
  await page.waitForLoadState("networkidle");
  await pause(2500);
});

// 3. Dashboard — what needs the owner.
await scene("03", "dashboard", DESKTOP, async ({ page, moveTo, pause, smoothScroll, check }) => {
  await page.goto(base + "/dashboard", { waitUntil: "networkidle" });
  await pause(2000);
  await check("dashboard shows the 'needs you' action", async () => {
    await moveTo(page.getByRole("link", { name: /Duyệt ngay|Review now|Khách hàng mới|New lead/i }).first());
  });
  await pause(1500);
  await smoothScroll(900);
  await pause(2000);
});

// 4. Office — the Zalo-style team chat: ask @sales, get the AI answer, look at an approval.
await scene("04", "office", DESKTOP, async ({ page, click, moveTo, pause, check }) => {
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  await pause(2000);
  const composer = page.getByRole("textbox", { name: /Tin nhắn|Message/i });
  await check("composer is visible without scrolling", async () => {
    const b = await composer.boundingBox();
    if (!b || b.y + b.height > 900) throw new Error("composer below the fold");
  });
  const log = page.getByRole("log").first();
  const chip = page.getByRole("group", { name: /Câu hỏi nhanh|Quick questions/i }).getByRole("button").first();
  const question = (await chip.innerText()).replace(/^@\w+\s*/, "").trim();
  await check("quick prompt sends the question to the team chat", async () => {
    await click(chip);
    await pause(800);
    const send = page.getByRole("button", { name: /^(Gửi|Send)$/ });
    if (await send.isEnabled()) await click(send);
    await log.getByText(question).last().waitFor({ timeout: 15_000 });
  });
  await check("Sales Agent answers within 60s (reply below the question, no error)", async () => {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (await page.getByText(/Chưa gửi được|Could not send|không phản hồi|unavailable/i).count()) throw new Error("error shown instead of an answer");
      const answered = await log.evaluate((el, q) => el.innerText.lastIndexOf("Sales Agent") > el.innerText.lastIndexOf(q), question);
      if (answered) return;
      await page.waitForTimeout(500);
    }
    throw new Error("no Sales Agent reply below the question");
  });
  await pause(4000);
  await check("approval card offers 'Duyệt và gửi'", async () => {
    await click(page.getByRole("button", { name: /Cần duyệt|Needs approval/i }).first());
    await pause(1200);
    await moveTo(page.getByRole("button", { name: /Duyệt và gửi|Approve and send/i }).first());
  });
  await pause(2500);
});

// 5. Leads — contact list → customer detail.
await scene("05", "leads", DESKTOP, async ({ page, click, pause, smoothScroll, check }) => {
  await page.goto(base + "/leads", { waitUntil: "networkidle" });
  await pause(2000);
  await check("lead list has customers", async () => {
    if ((await page.getByText(/Khách hàng [A-F]|Customer [A-F]/).count()) < 3) throw new Error("fewer than 3 leads");
  });
  await check("opening a lead shows its detail", async () => {
    await click(page.getByText(/Khách hàng A|Customer A/).first());
    await page.waitForURL(/\/leads\/[0-9a-f-]+/, { timeout: 30_000 });
  });
  await page.waitForLoadState("networkidle");
  await pause(2500);
  await smoothScroll(700);
  await pause(2000);
});

// 6. Agents — module list → 1:1 chat with an agent.
await scene("06", "agents", DESKTOP, async ({ page, click, pause, check }) => {
  await page.goto(base + "/modules", { waitUntil: "networkidle" });
  await pause(2000);
  await check("agent chat opens with a pinned composer", async () => {
    await click(page.getByRole("link", { name: /^Chat$/ }).first());
    await page.waitForURL(/\/modules\/.+\/chat/, { timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    const b = await page.getByRole("textbox").last().boundingBox();
    if (!b || b.y + b.height > 900) throw new Error("composer below the fold");
  });
  await pause(3000);
});

// 7. Phone — Office on a 390px screen.
await scene("07", "phone", PHONE, async ({ page, click, pause, check }) => {
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  await pause(2000);
  await check("phone: no horizontal scroll", async () => {
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    if (w > 392) throw new Error(`scrollWidth ${w}`);
  });
  await check("phone: back arrow opens the conversation list", async () => {
    await click(page.getByRole("button", { name: /Quay lại|Back|Trò chuyện|Chats/i }).first());
  });
  await pause(2500);
});

await browser.close();
const passed = results.filter((r) => r.ok).length;
writeFileSync(join(outDir, "uat-report.json"), JSON.stringify({ base, locale, at: new Date().toISOString(), passed, total: results.length, results }, null, 2));
console.log(`\nUAT ${passed}/${results.length} passed → ${outDir}`);
