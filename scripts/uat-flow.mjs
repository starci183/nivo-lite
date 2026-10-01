#!/usr/bin/env node
// Headless UAT of the NIVO operating flow, driven through the chat interface, with one video per scene and a pass/fail report.
//   "Giao quyền -> AI thực hiện -> Kiểm tra kết quả -> Chỉ hỏi khi cần"
// Usage: BASE_URL=https://nivo.vn UAT_LOCALE=vi node scripts/uat-flow.mjs <outDir>      (BASE_URL defaults to http://localhost:3100)
// Copy is asserted in Vietnamese (the default locale); a few labels also accept the English wording.
//
// Non-destructive on the shared demo workspace (one exception: if no Chatbot AI exists, it adds one via "Thêm vào workspace",
// because the flow starts at Chatbot AI; this build has no real payment):
//  - every input carries the run tag RUN ("UAT-xxxx") in its sender name and a unique phone number, and is a simulated event
//    (or the website chat, which is real AI but only ever talks to this script);
//  - it only decides work items whose card contains RUN. It never touches the seeded demo approval;
//  - the authority messages it types in Office tighten the "confirm order" limit by 1 million and then restore it in chat, so the settings end unchanged;
// A failing check fails honestly: the process exits non-zero and uat-report.json lists every failure with its reason.
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: node scripts/uat-flow.mjs <outDir>");
  process.exit(1);
}
const base = (process.env.BASE_URL || "http://localhost:3100").replace(/\/$/, "");
const locale = process.env.UAT_LOCALE || "vi";
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
mkdirSync(outDir, { recursive: true });

const RUN = `UAT-${Date.now().toString(36)}`;
const PHONE_NO = `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
const SENDER = `Khách ${RUN}`;
const REF = (n) => `${RUN}-${n}`;
const ITEMS = `Gói website ${RUN}`;
const digits = (s) => String(s).replace(/[^\d]/g, "");
const money = (n) => new RegExp(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "[.,\\s]?"));
const state = { leadUrl: null, limit: null, chatbotId: null, userName: null };

// A visible cursor + click ripple, because headless video has no pointer (same as uat-video.mjs).
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
/** Wall-clock start of each scene's video, so every check can be placed on that video's timeline (for narration sync). */
const sceneT0 = {};
const at = (sceneId, t) => (sceneT0[sceneId] ? Math.max(0, (t - sceneT0[sceneId]) / 1000) : null);
const check = async (sceneId, name, fn) => {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ scene: sceneId, name, ok: true, ms: Date.now() - t0, t_start: at(sceneId, t0), t_end: at(sceneId, Date.now()) });
    console.log(`  PASS ${name}`);
  } catch (e) {
    results.push({ scene: sceneId, name, ok: false, ms: Date.now() - t0, t_start: at(sceneId, t0), t_end: at(sceneId, Date.now()), error: String(e.message || e).split("\n")[0] });
    console.log(`  FAIL ${name}: ${String(e.message || e).split("\n")[0]}`);
  }
};

/** Record a check that could not run for a stated reason. Reported as skipped and never counted as a pass. */
const skip = (sceneId, name, reason) => {
  results.push({ scene: sceneId, name, ok: null, skipped: true, reason });
  console.log(`  SKIP ${name}: ${reason}`);
};

const browser = await chromium.launch();
let storageState;

/** Run one scene in a fresh recorded context; the video is renamed to <nn>-<id>.webm. */
const scene = async (nn, id, viewport, body) => {
  console.log(`scene ${nn} ${id}`);
  const context = await browser.newContext({
    viewport, deviceScaleFactor: 1, storageState, locale: locale === "vi" ? "vi-VN" : "en-US",
    recordVideo: { dir: outDir, size: viewport },
    ...(viewport.width < 768 ? { isMobile: true, hasTouch: false } : {}),
  });
  await context.addCookies([{ name: "NIVO_LOCALE", value: locale, url: base }]);
  await context.addInitScript(CURSOR);
  // Hide the host's floating "Powered by Netlify" badge for this test browser only (what a visitor's "Hide this badge" does).
  await context.addInitScript(() => {
    const hide = () => { const s = document.createElement("style"); s.textContent = "#nl-badge-frame{display:none!important}"; document.documentElement.appendChild(s); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hide); else hide();
  });
  const page = await context.newPage();
  sceneT0[id] = Date.now();
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(90_000);
  const mouse = { x: viewport.width / 2, y: viewport.height / 2 };
  const moveTo = async (locator) => {
    await locator.scrollIntoViewIfNeeded();
    await locator.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" })).catch(() => {});
    const b = await locator.boundingBox();
    if (!b) throw new Error("element not visible");
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y, { steps: 25 });
    mouse.x = x; mouse.y = y;
    await page.waitForTimeout(250);
  };
  const click = async (locator) => { await moveTo(locator); await page.mouse.down(); await page.mouse.up(); };
  /** Humans read: pause after every result. */
  const pause = (ms = 1800) => page.waitForTimeout(ms);
  /** Click into a field and type it out character by character, so the video shows the typing. */
  const type = async (locator, text, delay = 45) => { await click(locator); await page.keyboard.type(text, { delay }); };
  const smoothScroll = async (px, steps = 12) => { for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, px / steps); await page.waitForTimeout(60); } };
  /** Poll until fn() is truthy (or throw). */
  const until = async (what, fn, timeoutMs = 30_000, every = 700) => {
    const deadline = Date.now() + timeoutMs;
    let last;
    while (Date.now() < deadline) {
      try { last = await fn(); if (last) return last; } catch { /* keep polling */ }
      await page.waitForTimeout(every);
    }
    throw new Error(`timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${what}`);
  };
  /** Reload the page every few seconds until fn() is truthy: for data that arrives through the background queue. */
  const reloadUntil = async (what, fn, timeoutMs = 45_000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try { const v = await fn(); if (v) return v; } catch { /* keep polling */ }
      await page.waitForTimeout(3000);
      await page.reload({ waitUntil: "networkidle" }).catch(() => {});
    }
    throw new Error(`timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${what}`);
  };
  const helpers = { skip: (name, reason) => skip(id, name, reason), page, click, moveTo, pause, type, until, reloadUntil, smoothScroll, check: (name, fn) => check(id, name, fn) };
  try {
    await body(helpers);
  } catch (e) {
    results.push({ scene: id, name: "scene crashed", ok: false, error: String(e.message || e).split("\n")[0] });
    console.log(`  CRASH ${e.message}`);
  }
  if (id === "login") storageState = await context.storageState();
  const video = page.video();
  await context.close();
  if (video) { try { renameSync(await video.path(), join(outDir, `${nn}-${id}.webm`)); } catch { console.log(`  (no video frames for scene ${id})`); } }
};

// ---- shared page helpers -------------------------------------------------------------------------------------------------

const heading = (page, re) => page.getByRole("heading", { name: re }).first();
const visible = async (locator, what, timeout = 15_000) => { try { await locator.first().waitFor({ state: "visible", timeout }); } catch { throw new Error(`${what} is not visible`); } };
/** The amount field is a formatted number input (role textbox or spinbutton); getByLabel would also match its stepper buttons. */
const amountField = (scope) => scope.getByRole("textbox", { name: /Số tiền|Amount/ }).or(scope.getByRole("spinbutton", { name: /Số tiền|Amount/ })).first();
/** Mode label and limit of one rule row on /authority (the row is found by its action name). */
const readRule = (page, actionRe) => page.evaluate((source) => {
  const re = new RegExp(source);
  const group = [...document.querySelectorAll("[role=radiogroup]")].find((g) => re.test(g.parentElement?.innerText ?? ""));
  if (!group) return null;
  let row = group.parentElement;
  while (row && ![...row.querySelectorAll("input")].some((i) => /\d/.test(i.value))) row = row.parentElement;
  const limit = row ? [...row.querySelectorAll("input")].map((i) => i.value).find((v) => /\d/.test(v)) : null;
  return { mode: group.querySelector("[aria-checked=true]")?.textContent?.trim() ?? null, limit: limit ? Number(limit.replace(/[^\d]/g, "")) : null };
}, actionRe.source);
/** NIVO posts "Đã quyết định bởi <name> → NIVO đã tiếp tục: …" in the Office thread each time a decision resumes the work. */
const RESUMED = /Đã quyết định bởi\s+(.+?)\s*→\s*NIVO đã tiếp tục/g;
const officeText = async (page) => { const t = await officeLog(page).innerText().catch(() => ""); return t.trim() ? t : bodyText(page); };
const resumedCount = async (page) => [...(await officeText(page)).matchAll(RESUMED)].length;
/** An exception card in the Office thread that reached this status (done | rejected) and mentions the needle. */
const cardWith = (page, status, needle) => page.locator(`[data-testid="exception-card"][data-status="${status}"]`).filter({ hasText: needle });
/** Has NIVO posted "Đã quyết định bởi <name> → NIVO đã tiếp tục: … <ref> …" in the thread? */
const resumedFor = async (page, ref) => new RegExp(`Đã quyết định bởi\\s+[^\\n]+?→\\s*NIVO đã tiếp tục:[^\\n]*${ref}`).test(await officeText(page));
/** Name after "bởi" on a decided card ("Đã xong bởi An Nguyen · 02:48"). */
const deciderOf = async (card) => (await card.first().innerText()).match(/bởi\s+([^·\n]+?)\s*·/)?.[1] ?? null;
const bodyText = (page) => page.evaluate(() => document.body.innerText);

/** Pick an option in a HeroUI Select (a button that opens a listbox) or a native <select>. */
const pickSelect = async ({ page, click, pause }, label, option) => {
  const control = page.getByLabel(label, { exact: false }).first();
  const tag = await control.evaluate((el) => el.tagName).catch(() => "");
  if (tag === "SELECT") { await control.selectOption({ label: option }); return; }
  const trigger = page.getByRole("button", { name: label }).first();
  await click((await trigger.count()) ? trigger : control);
  await pause(400);
  await click(page.getByRole("option", { name: option, exact: true }).first());
  await pause(300);
};

/** Fill the /inbox simulator and press "Gửi vào NIVO". Returns the result alert text. */
const submitSimulator = async (h, input) => {
  const { page, click, type, pause, until } = h;
  await page.goto(`${base}/inbox`, { waitUntil: "networkidle" });
  await pause(800);
  await pickSelect(h, "Kênh", input.channel);
  await pickSelect(h, "Loại", input.kind);
  await type(page.getByLabel("Tên khách").first(), input.name);
  if (input.contact) await type(page.getByLabel("Điện thoại hoặc email").first(), input.contact);
  if (input.body) await type(page.getByLabel(/^Nội dung|^Message/).first(), input.body, 25);
  if (input.items) await type(page.getByLabel(/Hàng hóa|Dịch vụ|Items/).first(), input.items, 25);
  if (input.amount != null) {
    const amount = amountField(page);
    await click(amount);
    await page.keyboard.press("Control+A");
    await page.keyboard.type(String(input.amount), { delay: 60 });
    await page.keyboard.press("Tab");
  }
  if (input.reference) await type(page.getByLabel("Mã tham chiếu").first(), input.reference, 25);
  await pause(600);
  await click(page.getByRole("button", { name: /Gửi vào NIVO|Send to NIVO/ }).first());
  const alert = page.locator('[role="alert"], [role="status"]').filter({ hasText: /Đã nhận|Trùng lặp|Received|Duplicate/ }).first();
  await until("the simulator result", async () => alert.isVisible(), 30_000);
  const text = await alert.innerText();
  await pause(1800);
  return text;
};

/** Send a message in Office through the composer (typed like a person) and return once it is submitted. */
const sendInOffice = async ({ page, click, type }, text) => {
  const composer = page.getByRole("textbox", { name: /Tin nhắn|Message/i }).last();
  await type(composer, text, 40);
  await click(page.getByRole("button", { name: /^(Gửi|Send)$/ }).last());
};
const officeLog = (page) => page.getByRole("log").first();

/** The exception card in the Office thread that carries this run's tag and reason, and is still undecided. */
const openCard = (page, reason, needle = RUN) => officeLog(page)
  .locator("article, section, li, div")
  .filter({ hasText: new RegExp(reason, "i") })
  .filter({ hasText: needle })
  .filter({ has: page.getByRole("button", { name: /Đồng ý để NIVO tiếp tục|Từ chối/ }) })
  .last();

const leadPanel = async (page) => {
  await page.goto(state.leadUrl, { waitUntil: "networkidle" });
  return page.locator('[data-testid="lead-flow"]').first();
};
const panelHas = async (panel, testid, { status, re }) => {
  const rows = panel.locator(`[data-testid="${testid}"]`);
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const row = rows.nth(i);
    if (status && (await row.getAttribute("data-status")) !== status) continue;
    if (re && !re.test(await row.innerText())) continue;
    return true;
  }
  return false;
};

// ---- 0. Login ------------------------------------------------------------------------------------------------------------
await scene("00", "login", DESKTOP, async ({ page, click, pause, check }) => {
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  await pause(1500);
  await check("demo login leaves /login", async () => {
    await click(page.getByRole("button", { name: /Dùng thử ngay|Try NIVO now|demo/i }).first());
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  });
  await page.waitForLoadState("networkidle");
  await pause(1500);
});

// ---- 1. Giao quyền: read the authority, then grant it through the Office chat ---------------------------------------------
await scene("01", "giao-quyen", DESKTOP, async (h) => {
  const { page, pause, until, check } = h;
  await page.goto(base + "/authority", { waitUntil: "networkidle" });
  await pause(1500);
  await check("authority page shows Mục tiêu, Chính sách, Phạm vi tự động and Giới hạn", async () => {
    for (const re of [/Mục tiêu|Goals/, /Chính sách|Policies/, /Phạm vi tự động|Automation scope/, /Giới hạn|Limits/]) await visible(heading(page, re), String(re));
  });
  await check("staff section is marked optional (tùy chọn)", async () => { await visible(page.getByText(/tùy chọn|optional/i), "the optional staff section"); });
  await check("rule 'Xác nhận đơn hàng' shows a mode and a numeric limit", async () => {
    const found = await page.evaluate(() => {
      const norm = (s) => s.replace(/\s+/g, " ").trim();
      const hasLimit = (el) => [...el.querySelectorAll("input")].some((i) => /\d/.test(i.value));
      const labelled = [...document.querySelectorAll("*")].filter((el) => /Xác nhận đơn hàng|Confirm order/.test(norm(el.textContent || "")) && hasLimit(el));
      const row = labelled.sort((a, b) => a.textContent.length - b.textContent.length)[0];
      if (!row) return null;
      const input = [...row.querySelectorAll("input")].find((i) => /\d/.test(i.value));
      return { limit: input ? i2n(input.value) : null, text: norm(row.innerText) };
      function i2n(v) { return Number(String(v).replace(/[^\d]/g, "")); }
    });
    if (!found) throw new Error("no rule row for 'Xác nhận đơn hàng'");
    if (!/Tự động|Hỏi trước|Không bao giờ|Auto|Ask first|Never/.test(found.text)) throw new Error("no mode shown for the rule");
    if (!found.limit) throw new Error("no numeric limit on the rule");
    state.limit = found.limit;
    console.log(`    limit L = ${found.limit}`);
  });
  const limit = state.limit ?? 20_000_000;
  const tighter = limit - 1_000_000;
  const triệu = (n) => `${n / 1_000_000} triệu`;

  // Grant authority in the chat, then put it back in the chat: the settings end the run exactly as they began.
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  await pause(1500);
  const log = officeLog(page);
  /** Type one owner message, wait for it in the thread, and return NIVO's answer text (everything after the message). */
  const threadText = async () => { const t = await log.innerText().catch(() => ""); return t.trim() ? t : bodyText(page); };
  const say = async (message, needle) => {
    await sendInOffice(h, message);
    await until("my message in the thread", async () => (await threadText()).includes(needle), 20_000, 300);
    await pause(1200);
    return until("NIVO's answer in the thread", async () => {
      const text = await threadText();
      if (/Chưa gửi được|Could not send|not implemented/i.test(text)) throw new Error("an error is shown in the thread instead of NIVO's answer");
      const after = text.slice(text.lastIndexOf(needle) + needle.length);
      return /Đã lưu quyền bạn giao|Saved your authority|Tôi chưa thấy quyền/.test(after) ? after : null;
    }, 90_000, 1000);
  };
  const messageA = `@nivo Giao quyền: Sales tự xác nhận đơn hàng dưới ${triệu(tighter)}. ${RUN}`;
  await check(`owner types '@nivo Giao quyền: Sales tự xác nhận đơn hàng dưới ${triệu(tighter)}' in Office; NIVO confirms the rule in the thread`, async () => {
    const answer = await say(messageA, `dưới ${triệu(tighter)}. ${RUN}`);
    if (!/Đã lưu quyền bạn giao|Saved your authority/.test(answer)) throw new Error(`NIVO did not save the rule: ${answer.replace(/\s+/g, " ").trim().slice(0, 160)}`);
    if (!/Xác nhận đơn hàng|Confirm order/.test(answer)) throw new Error("NIVO's confirmation does not name 'Xác nhận đơn hàng'");
    const shows = answer.replace(/[.,\s]/g, "").includes(String(tighter)) || new RegExp(`\\b${tighter / 1_000_000}\\s*(triệu|tr|million|M)\\b`, "i").test(answer);
    if (!shows) throw new Error(`NIVO's confirmation does not show the new limit ${tighter}: ${answer.replace(/\s+/g, " ").trim().slice(0, 200)}`);
  });
  await pause(2500);
  await check("/authority shows the rule with the limit set through the chat", async () => {
    await page.goto(base + "/authority", { waitUntil: "networkidle" });
    await pause(1200);
    const rule = await readRule(page, /Xác nhận đơn hàng|Confirm order/);
    if (!rule) throw new Error("rule row 'Xác nhận đơn hàng' not found");
    if (rule.limit !== tighter) throw new Error(`limit is ${rule.limit}, expected ${tighter}`);
    if (!/Tự động|Auto/.test(rule.mode ?? "")) throw new Error(`mode is '${rule.mode}', expected Tự động`);
  });
  await pause(2000);
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  await pause(1200);
  await check(`owner restores the rule in chat ('dưới ${triệu(limit)}'); NIVO confirms and /authority shows Tự động up to ${limit} again`, async () => {
    const answer = await say(`@nivo Giao quyền: Sales tự xác nhận đơn hàng dưới ${triệu(limit)}, khôi phục như cũ. ${RUN}`, `khôi phục như cũ. ${RUN}`);
    if (!/Đã lưu quyền bạn giao|Saved your authority/.test(answer)) throw new Error(`NIVO did not save the rule: ${answer.replace(/\s+/g, " ").trim().slice(0, 160)}`);
    await pause(2000);
    await page.goto(base + "/authority", { waitUntil: "networkidle" });
    await pause(1200);
    const rule = await readRule(page, /Xác nhận đơn hàng|Confirm order/);
    if (!rule || rule.limit !== limit || !/Tự động|Auto/.test(rule.mode ?? "")) throw new Error(`rule is ${JSON.stringify(rule)}, expected Tự động up to ${limit}. THE DEMO WORKSPACE AUTHORITY IS LEFT CHANGED`);
  });
  await pause(2000);
});

// ---- 2. NIVO nhận đầu vào: a simulated Zalo message (twice, for dedupe) and the real-AI website chat ----------------------------
await scene("02", "nhan-dau-vao", DESKTOP, async (h) => {
  const { page, pause, until, check } = h;
  await page.goto(base + "/inbox", { waitUntil: "networkidle" });
  await pause(1500);
  await check("inbox warns that Zalo, Facebook, Email and Ngân hàng are simulated (mô phỏng)", async () => {
    const alert = page.locator('[role="alert"], [role="status"]').filter({ hasText: /mô phỏng|simulated/i }).first();
    await visible(alert, "the simulated-channels alert");
  });
  const zalo = { channel: "Zalo", kind: "Tin nhắn", name: SENDER, contact: PHONE_NO, body: "Cần tư vấn gói chăm sóc khách hàng" };
  await check("Zalo message is received and NIVO says 'Đã nhận'", async () => {
    const text = await submitSimulator(h, zalo);
    if (!/Đã nhận|Received/.test(text)) throw new Error(`result was: ${text.split("\n")[0]}`);
  });
  await check("feed's first row shows the run tag, Zalo and the Mô phỏng badge", async () => {
    await page.reload({ waitUntil: "networkidle" });
    const row = page.locator("li, article, tr").filter({ hasText: RUN }).first();
    await visible(row, "a feed row with the run tag");
    const text = await row.innerText();
    if (!/Zalo/.test(text)) throw new Error("row does not say Zalo");
    if (!/Mô phỏng|Simulated/.test(text)) throw new Error("row has no Mô phỏng badge");
    const first = page.locator("li, article, tr").filter({ hasText: /Zalo|Facebook|Email|Ngân hàng|Website|Bank/ }).first();
    if (!(await first.innerText()).includes(RUN)) throw new Error("the run's row is not first in the feed");
  });
  await check("the identical message is reported as 'Trùng lặp' with a duplicate count of at least 1", async () => {
    const text = await submitSimulator(h, zalo);
    if (!/Trùng lặp|Duplicate/.test(text)) throw new Error(`result was: ${text.split("\n")[0]}`);
    if (!/[1-9]/.test(text)) throw new Error("no duplicate count in the result");
    await page.reload({ waitUntil: "networkidle" });
    const row = page.locator("li, article, tr").filter({ hasText: RUN }).first();
    if (!/[1-9]/.test((await row.innerText()).replace(RUN, "").replace(PHONE_NO, ""))) throw new Error("feed row shows no duplicate count");
  });

  // Website chat: real AI, the owner plays the visitor. This is the only live input in the run.
  await page.goto(base + "/modules", { waitUntil: "networkidle" });
  await pause(1200);
  // Only the Chatbot has a customer channel: pick the module whose chat page offers the "Website chat" tab.
  const chatHrefs = await page.locator('a[href*="/modules/"][href$="/chat"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("href")))]);
  let chatbotId = null;
  for (const href of chatHrefs) {
    const id = href?.match(/\/modules\/([^/]+)\/chat/)?.[1];
    if (!id) continue;
    await page.goto(`${base}/modules/${id}/chat?tab=customer`, { waitUntil: "networkidle" });
    if (await page.getByRole("tab", { name: /Website chat/ }).count()) { chatbotId = id; break; }
  }
  if (!chatbotId) {
    // Step 1 of the flow starts at Chatbot AI. Adding it is the in-app "Thêm vào workspace" (no real payment in this build).
    await check("owner adds Chatbot AI to the workspace through the module setup", async () => {
      await page.goto(`${base}/modules/new?module=chatbot`, { waitUntil: "networkidle" });
      await pause(1500);
      await h.click(page.getByRole("button", { name: /Thêm vào workspace|Add to workspace/ }).first());
      await page.waitForURL(/\/modules\/[^/]+\/chat/, { timeout: 60_000 });
      chatbotId = page.url().match(/\/modules\/([^/?]+)\/chat/)?.[1] ?? null;
      if (!chatbotId) throw new Error("no chatbot id after install");
    });
    await pause(1500);
  }
  state.chatbotId = chatbotId;
  if (!chatbotId) {
    h.skip("Chatbot customer tab is titled 'AI thật'; website chat gets a real AI answer", "no Chatbot module is installed in this workspace (installing one is a purchase, which this script never makes)");
  } else {
  await check("Chatbot customer tab is titled as real AI ('AI thật') with the visitor played by the owner", async () => {
    await page.goto(`${base}/modules/${chatbotId}/chat?tab=customer`, { waitUntil: "networkidle" });
    await pause(1200);
    await visible(page.getByText(/AI thật|Real AI/).first(), "the 'AI thật' badge");
    await visible(page.getByText(/bạn đóng vai khách|You play the visitor/i).first(), "the visitor-role note");
  });
  await check("website chat: the real AI answers the visitor within 90s", async () => {
    await h.type(page.getByLabel(/Tên khách|Visitor name/).first(), `Khách web ${RUN}`);
    await h.click(page.getByRole("button", { name: /Bắt đầu với khách|Start visitor chat/ }).first());
    await until("the visitor thread", async () => page.getByRole("textbox", { name: /Tin nhắn|Message/i }).first().isVisible(), 20_000);
    await h.type(page.getByRole("textbox", { name: /Tin nhắn|Message/i }).first(), `Xin chào, mình là Khách web ${RUN}, số điện thoại ${PHONE_NO.replace(/^09/, "08")}, cần tư vấn gói chăm sóc khách hàng, nhờ bên bạn liên hệ lại.`, 25);
    await h.click(page.getByRole("button", { name: /^(Gửi|Send)$/ }).first());
    // The page has several role="log" regions (history, empty states); read the one holding the visitor's message.
    const log = page.getByRole("log").filter({ hasText: "nhờ bên bạn liên hệ lại" }).first();
    await until("an AI reply below the visitor's message", async () => {
      const text = (await log.innerText()).replace(/\s+/g, " ");
      if (/Chưa gửi được|Message not sent|không phản hồi/.test(text)) throw new Error("the chat shows an error instead of an answer");
      // The agent's bubble (its name + a real sentence) must come after the visitor's message.
      const at = text.lastIndexOf("nhờ bên bạn liên hệ lại"); const after = at < 0 ? "" : text.slice(at + "nhờ bên bạn liên hệ lại".length);
      return /Chatbot/.test(after) && after.replace(/[^\p{L}]/gu, "").length > 40;
    }, 90_000, 1000);
  });
  }
  await pause(3000);
});

// ---- 3. Các bộ phận AI tự vận hành: routine work completes itself and NIVO reports it in Office ------------------------------
await scene("03", "ai-tu-van-hanh", DESKTOP, async (h) => {
  const { page, click, pause, reloadUntil, check } = h;
  await check("a lead for the run's sender appears within 60s and opens", async () => {
    await page.goto(`${base}/leads?q=${encodeURIComponent(RUN)}`, { waitUntil: "networkidle" });
    const href = await reloadUntil("the lead for the run's sender", async () => {
      const link = page.locator('a[href^="/leads/"]').filter({ hasText: SENDER }).first();
      return (await link.count()) ? link.getAttribute("href") : null;
    }, 60_000);
    state.leadUrl = new URL(href, base).toString();
    await page.goto(state.leadUrl, { waitUntil: "networkidle" });
  });
  await pause(1500);
  if (!state.leadUrl) return;
  await check("lead panel 'Dòng chảy công việc': Chatbot AI · Chuyển lead · Đã xong · Tự động", async () => {
    await reloadUntil("the handoff work item", async () => {
      const panel = page.locator('[data-testid="lead-flow"]').first();
      return panelHas(panel, "flow-work-item", { status: "done", re: /Chatbot AI · Chuyển lead · Đã xong · Tự động/ });
    }, 45_000);
    await visible(heading(page, /Dòng chảy công việc|Work flow/).or(page.getByText(/Dòng chảy công việc|Work flow/).first()), "the flow panel title");
    await page.locator('[data-testid="lead-flow"]').first().scrollIntoViewIfNeeded();
  });
  await check("lead panel shows 'Sales AI · Phân loại'", async () => {
    await reloadUntil("the classification work item", async () => panelHas(page.locator('[data-testid="lead-flow"]').first(), "flow-work-item", { re: /Sales AI · Phân loại/ }), 45_000);
  });
  await pause(2500);

  await check("Facebook order of 5,000,000 (below the limit) is received", async () => {
    const text = await submitSimulator(h, { channel: "Facebook", kind: "Đơn hàng", name: SENDER, contact: PHONE_NO, items: ITEMS, amount: 5_000_000, reference: REF("O1") });
    if (!/Đã nhận|Received/.test(text)) throw new Error(`result was: ${text.split("\n")[0]}`);
  });
  await check("within 30s the lead has the order confirmed by policy and an issued invoice of 5,000,000", async () => {
    await page.goto(state.leadUrl, { waitUntil: "networkidle" });
    await reloadUntil("the confirmed order and the issued invoice", async () => {
      const panel = page.locator('[data-testid="lead-flow"]').first();
      return (await panelHas(panel, "flow-work-item", { status: "done", re: /Sales AI · Xác nhận đơn hàng · Đã xong · Tự động/ }))
        && (await panelHas(panel, "flow-order", { re: money(5_000_000) }))
        && (await panelHas(panel, "flow-invoice", { status: "issued", re: money(5_000_000) }))
        && (await panelHas(panel, "flow-work-item", { status: "done", re: /Kế toán AI · Xuất hóa đơn · Đã xong · Tự động/ }));
    }, 30_000);
  });
  await pause(2500);
  await check("NIVO reported the auto-completed work in the Office thread", async () => {
    await page.goto(base + "/chat", { waitUntil: "networkidle" });
    await pause(1200);
    const log = officeLog(page);
    await h.until("an auto-completion line mentioning the run", async () => {
      const text = await log.innerText();
      const at = text.lastIndexOf(RUN);
      return at >= 0 && /hóa đơn|xác nhận|tự hoàn thành|đã xử lý|Kế toán AI|Sales AI/i.test(text.slice(Math.max(0, at - 400), at + 600));
    }, 30_000);
  });
  await pause(2500);
  await check("/decisions?kind=policy has at least 2 rows for the run, decided 'NIVO · theo chính sách'", async () => {
    await page.goto(`${base}/decisions?kind=policy`, { waitUntil: "networkidle" });
    await pause(1500);
    const rows = page.locator("li, article, tr").filter({ hasText: RUN }).filter({ hasText: /NIVO · theo chính sách|NIVO · by policy/ });
    const n = await rows.count();
    if (n < 2) throw new Error(`only ${n} policy decision rows carry the run tag`);
  });
  await pause(2000);
});

// ---- 4. Tự xử lý hoặc xin quyết định: exceptions arrive in the Office thread and the owner decides in chat ----------------------
await scene("04", "xin-quyet-dinh", DESKTOP, async (h) => {
  const { page, click, moveTo, pause, until, reloadUntil, check } = h;
  if (!state.leadUrl) { results.push({ scene: "xin-quyet-dinh", name: "prerequisite: the run's lead exists", ok: false, error: "no lead url from scene 03" }); return; }

  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  await pause(1500);
  await check("Office send is optimistic: the text is in the thread within 1s, before any Sales reply", async () => {
    const text = `@sales ${RUN} kiểm tra`;
    const log = officeLog(page);
    const composer = page.getByRole("textbox", { name: /Tin nhắn|Message/i }).last();
    await h.type(composer, text, 40);
    const before = (await log.innerText()).split("Sales Agent").length;
    const sendButton = page.getByRole("button", { name: /^(Gửi|Send)$/ }).last();
    await moveTo(sendButton);
    const t0 = Date.now();
    await page.mouse.down();
    await page.mouse.up();
    await until("the message or its pending bubble", async () => {
      const shown = (await log.innerText()).includes(`${RUN} kiểm tra`);
      const pending = await page.locator('[data-testid="msg-pending"]').count();
      return shown || pending > 0;
    }, 1000, 50);
    const took = Date.now() - t0;
    if (took > 1000) throw new Error(`took ${took}ms`);
    if ((await log.innerText()).split("Sales Agent").length > before) throw new Error("a Sales Agent reply was already there (not proven optimistic)");
  });
  await pause(2500);

  // Over authority: 45,000,000 is above the limit, so NIVO asks. The owner agrees in the thread and NIVO carries on.
  await check("over-authority order (45,000,000) is received", async () => {
    const text = await submitSimulator(h, { channel: "Facebook", kind: "Đơn hàng", name: SENDER, contact: PHONE_NO, items: ITEMS, amount: 45_000_000, reference: REF("O2") });
    if (!/Đã nhận|Received/.test(text)) throw new Error(`result was: ${text.split("\n")[0]}`);
  });
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  await check("Office thread shows a 'Vượt quyền' card for the run with 'NIVO đề xuất'", async () => {
    await reloadUntil("the over-authority card", async () => (await openCard(page, "Vượt quyền|Over authority", REF("O2")).count()) > 0, 45_000);
    const card = openCard(page, "Vượt quyền|Over authority", REF("O2"));
    await visible(card, "the card");
    if (!/NIVO đề xuất|NIVO proposes/i.test(await card.innerText())) throw new Error("card has no 'NIVO đề xuất'");
    await card.scrollIntoViewIfNeeded();
  });
  await pause(2500);
  await check("owner clicks 'Đồng ý để NIVO tiếp tục'; the card shows who decided, and NIVO posts 'Đã quyết định bởi <name> → NIVO đã tiếp tục'", async () => {
    await click(openCard(page, "Vượt quyền|Over authority", REF("O2")).getByRole("button", { name: /Đồng ý để NIVO tiếp tục/ }).first());
    await reloadUntil("the O2 card to show as decided", async () => (await cardWith(page, "done", REF("O2")).count()) > 0, 45_000);
    state.userName = await deciderOf(cardWith(page, "done", REF("O2")));
    if (!state.userName) throw new Error("the decided card names nobody after 'bởi'");
    await reloadUntil("NIVO's resumed message for O2", () => resumedFor(page, REF("O2")), 45_000).catch(() => {});
    if (!(await resumedFor(page, REF("O2")))) throw new Error(`no 'Đã quyết định bởi … → NIVO đã tiếp tục: … ${REF("O2")}' message in the Office thread`);
  });
  await pause(2500);
  await check("without more clicks, NIVO continues: the lead has the 45,000,000 invoice issued within 30s", async () => {
    await page.goto(state.leadUrl, { waitUntil: "networkidle" });
    await reloadUntil("the 45,000,000 invoice", async () => panelHas(page.locator('[data-testid="lead-flow"]').first(), "flow-invoice", { status: "issued", re: money(45_000_000) }), 30_000);
  });
  await pause(2500);

  // Missing data: an order with no amount. The card asks for it; the owner fills it in and NIVO finishes the job.
  await check("order with no amount is received", async () => {
    const text = await submitSimulator(h, { channel: "Facebook", kind: "Đơn hàng", name: SENDER, contact: PHONE_NO, items: ITEMS, reference: REF("O3") });
    if (!/Đã nhận|Received/.test(text)) throw new Error(`result was: ${text.split("\n")[0]}`);
  });
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  await check("card 'Thiếu dữ kiện' shows a 'Số tiền (VND)' input", async () => {
    await reloadUntil("the missing-data card", async () => (await openCard(page, "Thiếu dữ kiện|Missing data", REF("O3")).count()) > 0, 45_000);
    await visible(amountField(openCard(page, "Thiếu dữ kiện|Missing data", REF("O3"))), "the amount input");
  });
  await pause(2000);
  await check("owner fills 3,000,000 and continues; the 3,000,000 invoice appears", async () => {
    const card = openCard(page, "Thiếu dữ kiện|Missing data", REF("O3"));
    const amount = amountField(card);
    await click(amount);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("3000000", { delay: 70 });
    await page.keyboard.press("Tab");
    await pause(800);
    await click(card.getByRole("button", { name: /Sửa rồi tiếp tục|Đồng ý để NIVO tiếp tục/ }).first());
    await reloadUntil("the O3 card to show as decided", async () => (await cardWith(page, "done", REF("O3")).count()) > 0, 45_000);
    if (!(await deciderOf(cardWith(page, "done", REF("O3"))))) throw new Error("the decided card names nobody after 'bởi'");
    await reloadUntil("NIVO's resumed message for O3", () => resumedFor(page, REF("O3")), 45_000).catch(() => {});
    if (!(await resumedFor(page, REF("O3")))) throw new Error(`no 'Đã quyết định bởi … → NIVO đã tiếp tục: … ${REF("O3")}' message in the Office thread`);
    await page.goto(state.leadUrl, { waitUntil: "networkidle" });
    await reloadUntil("the 3,000,000 invoice", async () => panelHas(page.locator('[data-testid="lead-flow"]').first(), "flow-invoice", { status: "issued", re: money(3_000_000) }), 30_000);
  });
  await pause(2500);

  // Unclear: a bank transfer that cannot be matched with certainty. The owner picks the right invoice.
  await check("bank payment of 5,000,000 with an unclear reference is received", async () => {
    const text = await submitSimulator(h, { channel: "Ngân hàng", kind: "Thanh toán", name: `Người chuyển ${RUN}`, amount: 5_000_000, reference: `CK ${RUN} khong ro` });
    if (!/Đã nhận|Received/.test(text)) throw new Error(`result was: ${text.split("\n")[0]}`);
  });
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  await check("card 'Chưa rõ kết quả' offers the run's invoice as a selectable candidate", async () => {
    await reloadUntil("the unclear-outcome card", async () => (await openCard(page, "Chưa rõ kết quả|Unclear outcome").count()) > 0, 45_000);
    const card = openCard(page, "Chưa rõ kết quả|Unclear outcome");
    await visible(card.getByRole("radio", { name: new RegExp(RUN) }).or(card.getByRole("option", { name: new RegExp(RUN) })).or(card.getByText(new RegExp(REF("O1")))).or(card.getByText(/INV-/)), "a candidate invoice");
  });
  await pause(2500);
  await check("owner chooses the run's invoice and continues; it becomes 'Đã thanh toán' and Sales AI queues 'Gửi chăm sóc'", async () => {
    const card = openCard(page, "Chưa rõ kết quả|Unclear outcome");
    const radios = card.getByRole("radio");
    const mine = radios.filter({ hasText: new RegExp(RUN) });
    await click((await mine.count()) ? mine.first() : radios.first());
    await pause(800);
    await click(card.getByRole("button", { name: /Đồng ý để NIVO tiếp tục|Sửa rồi tiếp tục/ }).first());
    await reloadUntil("the payment card to show as decided", async () => (await cardWith(page, "done", RUN)).filter({ hasText: /Đối soát|Reconcile/ }).count().then((n) => n > 0), 45_000);
    await page.goto(state.leadUrl, { waitUntil: "networkidle" });
    await reloadUntil("the paid invoice and the care work item", async () => {
      const panel = page.locator('[data-testid="lead-flow"]').first();
      return (await panelHas(panel, "flow-invoice", { status: "paid", re: money(5_000_000) })) && (await panelHas(panel, "flow-work-item", { re: /Sales AI · Gửi chăm sóc/ }));
    }, 45_000);
  });
  await pause(2500);

  // Reject: NIVO must not invoice an order the owner refused.
  await check("order O4 of 45,000,000 is received and the owner rejects it ('Đã từ chối', no O4 invoice)", async () => {
    await page.goto(state.leadUrl, { waitUntil: "networkidle" });
    const invoicesBefore = await page.locator('[data-testid="flow-invoice"]').count();
    const text = await submitSimulator(h, { channel: "Facebook", kind: "Đơn hàng", name: SENDER, contact: PHONE_NO, items: ITEMS, amount: 45_000_000, reference: REF("O4") });
    if (!/Đã nhận|Received/.test(text)) throw new Error(`result was: ${text.split("\n")[0]}`);
    await page.goto(base + "/chat", { waitUntil: "networkidle" });
    await reloadUntil("the O4 card", async () => (await openCard(page, "Vượt quyền|Over authority", REF("O4")).count()) > 0, 45_000);
    const rejectButton = () => openCard(page, "Vượt quyền|Over authority", REF("O4")).getByRole("button", { name: /^Từ chối|Reject/ }).first();
    await click(rejectButton());
    // A missed click must not pass silently: the card has to reach 'rejected', otherwise click once more and then fail.
    const isRejected = async () => (await cardWith(page, "rejected", REF("O4")).count()) > 0;
    if (!(await until("the O4 card to show as rejected", isRejected, 10_000, 500).catch(() => false))) {
      if ((await openCard(page, "Vượt quyền|Over authority", REF("O4")).count()) > 0) await click(rejectButton());
      await reloadUntil("the O4 card to show as rejected (Đã từ chối)", isRejected, 30_000);
    }
    if (!/Đã từ chối|Rejected/.test(await cardWith(page, "rejected", REF("O4")).first().innerText())) throw new Error("the rejected card does not say 'Đã từ chối'");
    await pause(5000);
    await page.goto(state.leadUrl, { waitUntil: "networkidle" });
    const panel = page.locator('[data-testid="lead-flow"]').first();
    if (!(await panelHas(panel, "flow-work-item", { status: "rejected", re: /Xác nhận đơn hàng/ }))) throw new Error("the lead panel shows no rejected 'Xác nhận đơn hàng' work item");
    const invoicesAfter = await page.locator('[data-testid="flow-invoice"]').count();
    if (invoicesAfter !== invoicesBefore) throw new Error(`the invoice count changed ${invoicesBefore} -> ${invoicesAfter} after rejecting O4`);
  });
  await pause(2000);
});

// ---- 5. Kết quả quản trị: dashboard and decision history ------------------------------------------------------------------------
await scene("05", "ket-qua", DESKTOP, async (h) => {
  const { page, pause, check, smoothScroll } = h;
  await page.goto(base + "/dashboard", { waitUntil: "networkidle" });
  await pause(2000);
  await check("dashboard headings: Kết quả thật, Việc đang chờ, Ngoại lệ cần chú ý, Lịch sử quyết định", async () => {
    for (const re of [/Kết quả thật|Real results/, /Việc đang chờ|Waiting for you/, /Ngoại lệ cần chú ý|Exceptions needing attention/, /Lịch sử quyết định|Decision history/]) await visible(heading(page, re), String(re));
  });
  await check("'Kết quả thật' shows a VND figure and mentions mô phỏng", async () => {
    const text = await page.getByRole("region", { name: /Kết quả thật|Real results/ }).first().innerText();
    if (!/\d[\d.,]*\s?(đ|₫|VND)/i.test(text)) throw new Error("no VND figure in the section");
    if (!/mô phỏng|simulated/i.test(text)) throw new Error("no 'mô phỏng' source line in the section");
  });
  await smoothScroll(500);
  await pause(1500);
  let dashboardPending;
  await check("'Việc đang chờ' number is readable", async () => {
    const text = await page.getByRole("region", { name: /Việc đang chờ|Waiting for you/ }).first().innerText();
    const n = text.match(/\d+/)?.[0];
    if (n !== undefined) dashboardPending = Number(n);
    else if (/không có|chưa có|nothing|none/i.test(text)) dashboardPending = 0;
    else throw new Error("no number in the section");
  });
  await check("the Office chip shows the same pending number as the dashboard", async () => {
    await page.goto(base + "/chat", { waitUntil: "networkidle" });
    await pause(1200);
    const chips = await page.getByRole("button").allInnerTexts();
    const chip = chips.map((s) => s.match(/(?:Cần duyệt|Cần quyết định|Chờ quyết định|Needs approval|Needs decision)[^\d]*(\d+)/i)).find(Boolean);
    if (!chip) throw new Error("no pending chip in the Office header");
    if (Number(chip[1]) !== dashboardPending) throw new Error(`Office chip ${chip[1]} vs dashboard ${dashboardPending}`);
  });
  await page.goto(base + "/dashboard", { waitUntil: "networkidle" });
  const historyRow = async () => {
    const section = page.getByRole("region", { name: /Lịch sử quyết định|Decision history/ }).first();
    const entry = section.locator("div").filter({ hasText: RUN }).last();
    await visible(entry, "an entry with the run tag");
    return (await entry.locator("xpath=..").innerText()).replace(/\s+/g, " ");
  };
  await check("'Lịch sử quyết định' lists an entry for the run with the decider's name", async () => {
    const flat = await historyRow();
    if (!/NIVO · theo chính sách|NIVO · by policy/.test(flat) && !new RegExp(`(Chatbot AI|Sales AI|Kế toán AI|Accounting AI) · (?!${RUN})\\S+`).test(flat)) throw new Error(`no decider name in: ${flat.slice(0, 140)}`);
  });
  await check("the same history entry shows a relative time ('… phút trước')", async () => {
    const flat = await historyRow();
    if (!/(vừa xong|phút trước|giờ trước|ngày trước|just now|ago)/i.test(flat)) throw new Error(`no relative time in: ${flat.slice(0, 140)}`);
  });
  await pause(2000);
  await check("/decisions?kind=human shows the run's outcomes Đã duyệt and Đã sửa", async () => {
    await page.goto(`${base}/decisions?kind=human`, { waitUntil: "networkidle" });
    await pause(1500);
    const text = (await page.locator("li, article, tr").filter({ hasText: RUN }).allInnerTexts()).join("\n");
    for (const re of [/Đã duyệt|Approved/, /Đã sửa|Edited/]) if (!re.test(text)) throw new Error(`no row with ${re}`);
  });
  await pause(2000);
  await check("/decisions?kind=rejected shows the run's rejected order (Đã từ chối)", async () => {
    await page.goto(`${base}/decisions?kind=rejected`, { waitUntil: "networkidle" });
    await pause(1500);
    const text = (await page.locator("li, article, tr").filter({ hasText: RUN }).allInnerTexts()).join("\n");
    if (!/Đã từ chối|Rejected/.test(text)) throw new Error("no rejected row for the run");
  });
  await pause(2000);
  await check("/decisions?kind=policy shows automatic rows for the run", async () => {
    await page.goto(`${base}/decisions?kind=policy`, { waitUntil: "networkidle" });
    await pause(1500);
    if ((await page.locator("li, article, tr").filter({ hasText: RUN }).filter({ hasText: /NIVO · theo chính sách|NIVO · by policy/ }).count()) < 1) throw new Error("no auto row for the run");
  });
  await pause(2000);
});

// ---- 6. Phone (390) --------------------------------------------------------------------------------------------------------------
await scene("06", "phone", PHONE, async (h) => {
  const { page, click, pause, check } = h;
  for (const path of ["/authority", "/inbox", "/decisions", "/dashboard", "/chat"]) {
    await check(`phone ${path}: no horizontal scroll (scrollWidth <= 392)`, async () => {
      await page.goto(base + path, { waitUntil: "networkidle" });
      await pause(1200);
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      if (w > 392) throw new Error(`scrollWidth ${w}`);
    });
  }
  await check("phone: exception card buttons are at least 40px tall", async () => {
    await page.goto(base + "/chat", { waitUntil: "networkidle" });
    await pause(1200);
    let buttons = page.getByRole("button", { name: /Đồng ý để NIVO tiếp tục/ });
    if (!(await buttons.count())) {
      const list = page.getByRole("button", { name: /Office|Nhóm|Team/ }).first();
      if (await list.count()) { await click(list); await pause(1200); }
      buttons = page.getByRole("button", { name: /Đồng ý để NIVO tiếp tục/ });
    }
    const n = await buttons.count();
    if (!n) throw new Error("no exception card on the phone Office to measure");
    for (let i = 0; i < n; i++) {
      const b = await buttons.nth(i).boundingBox();
      if (b && b.height < 40) throw new Error(`button ${i} is ${Math.round(b.height)}px tall`);
    }
  });
  await pause(2000);
});

await browser.close();
const ran = results.filter((r) => !r.skipped);
const passed = ran.filter((r) => r.ok).length;
const skipped = results.length - ran.length;
writeFileSync(join(outDir, "uat-report.json"), JSON.stringify({ base, locale, run: RUN, phone: PHONE_NO, at: new Date().toISOString(), passed, failed: ran.length - passed, skipped, total: ran.length, results }, null, 2));
console.log(`\nUAT flow ${passed}/${ran.length} passed, ${skipped} skipped (run ${RUN}) → ${outDir}`);
if (passed !== ran.length) process.exit(1);
