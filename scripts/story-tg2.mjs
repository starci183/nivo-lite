#!/usr/bin/env node
// Story recording for the NIVO intro video: one small business, real people-like customers, every step narrated.
//   Spa Hoa Mai (owner: the signed-in account) — chị Lan on Telegram (REAL channel, the owner's test Telegram account plays her),
//   anh Minh on Zalo (simulated in /inbox), Công ty Ánh Dương on Facebook (simulated), one unclear bank transfer (simulated).
// Output: <outDir>/<nn>-<scene>[-tg].webm + story.json (cue timeline per scene, for narration + subtitles in sync).
// Usage: BASE_URL=https://nivo.vn node scripts/story-video.mjs <outDir>
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const outDir = process.argv[2];
if (!outDir) { console.error("usage: node scripts/story-video.mjs <outDir>"); process.exit(1); }
mkdirSync(outDir, { recursive: true });
const base = process.env.BASE_URL || "https://nivo.vn";
const BOT = process.env.TELEGRAM_BOT_USERNAME || "nivo_demo_bot";
const TG_PROFILE = "D:/starci-lanes/.telegram-profile";
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 420, height: 860 };
const rnd = String(Date.now()).slice(-4);
const phone = (p) => `09${p}${rnd}${String(Math.floor(Math.random() * 90) + 10)}`;
const LAN_PHONE = phone("12");
const MINH_PHONE = phone("34");
const AD_PHONE = phone("56");
const REF_MINH = `ZL-${rnd}`;
const REF_AD = `FB-${rnd}`;

const story = { base, run: rnd, scenes: [] };
if (process.env.SCENES) {
  // Merge into the previous take: keep every scene that is not being re-recorded.
  const { existsSync, readFileSync } = await import("node:fs");
  const prev = join(outDir, "story.json");
  if (existsSync(prev)) story.scenes = JSON.parse(readFileSync(prev, "utf8")).scenes;
}
let current = null;
/** A narration line + the on-screen chip shown with it. */
const cue = (text, chip = null) => {
  const t = (Date.now() - current.t0) / 1000;
  current.cues.push({ t, text, chip });
  console.log(`  [${t.toFixed(1)}s] ${text.slice(0, 90)}`);
};

const CURSOR = () => {
  const install = () => {
    if (document.getElementById("__cur")) return;
    const c = document.createElement("div");
    c.id = "__cur";
    c.style.cssText = "position:fixed;left:-40px;top:-40px;width:24px;height:24px;z-index:2147483647;pointer-events:none;background:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M3 2l7 19 2.5-7.5L20 11z' fill='%23111' stroke='white' stroke-width='1.5'/></svg>\") no-repeat;";
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX - 3 + "px"; c.style.top = e.clientY - 2 + "px"; }, true);
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      r.style.cssText = `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;border:3px solid #E11D48;z-index:2147483646;pointer-events:none;transition:all .5s ease-out`;
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = "scale(1.8)"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 600);
    }, true);
    const s = document.createElement("style");
    s.textContent = "#nl-badge-frame{display:none!important}";
    document.documentElement.appendChild(s);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
};

const browser = await chromium.launch();
let storageState;

const helpersFor = (page) => {
  const moveTo = async (loc) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" })).catch(() => {});
    const b = await loc.boundingBox();
    if (!b) throw new Error("element not visible");
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 30 });
    await page.waitForTimeout(300);
  };
  const click = async (loc) => {
    await moveTo(loc);
    const b = await loc.boundingBox().catch(() => null);
    if (b && current) (current.clicks ??= []).push({ t: (Date.now() - current.t0) / 1000, telegram: page !== current.page, x: b.x + b.width / 2, y: b.y + b.height / 2 });
    await page.mouse.down(); await page.mouse.up();
  };
  const pause = (ms = 2200) => page.waitForTimeout(ms);
  const type = async (loc, text, delay = 55) => { await click(loc); await page.keyboard.type(text, { delay }); };
  /** Draw a crimson frame around what the narration talks about. */
  const spot = async (loc, ms = 2600) => {
    loc = loc.first();
    // Never stall the recording on a missing element: wait briefly, otherwise just hold the shot.
    if (!(await loc.isVisible().catch(() => false))) {
      try { await loc.waitFor({ state: "visible", timeout: 6000 }); } catch { await page.waitForTimeout(Math.min(ms, 2000)); return; }
    }
    await moveTo(loc).catch(() => {});
    const b = await loc.boundingBox().catch(() => null);
    if (!b) return;
    // Remember where the camera should look (video-space px) for the auto-zoom in the edit.
    if (current) (current.focus ??= []).push({ t: (Date.now() - current.t0) / 1000, ms, telegram: page !== current.page, x: b.x, y: b.y, w: b.width, h: b.height });
    await page.evaluate(({ x, y, w, h, ms }) => {
      const d = document.createElement("div");
      d.style.cssText = `position:fixed;left:${x - 8}px;top:${y - 8}px;width:${w + 16}px;height:${h + 16}px;border:4px solid #E11D48;border-radius:12px;box-shadow:0 0 0 6px rgba(225,29,72,.18);z-index:2147483645;pointer-events:none;transition:opacity .4s`;
      document.documentElement.appendChild(d);
      setTimeout(() => { d.style.opacity = "0"; setTimeout(() => d.remove(), 450); }, ms);
    }, { x: b.x, y: b.y, w: b.width, h: b.height, ms });
    await page.waitForTimeout(ms);
  };
  const until = async (what, fn, timeoutMs = 60_000, every = 800) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) { try { const v = await fn(); if (v) return v; } catch { /* poll */ } await page.waitForTimeout(every); }
    throw new Error(`timed out waiting for ${what}`);
  };
  const reloadUntil = async (what, fn, timeoutMs = 60_000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) { try { const v = await fn(); if (v) return v; } catch { /* poll */ } await page.waitForTimeout(3000); await page.reload({ waitUntil: "networkidle" }).catch(() => {}); }
    throw new Error(`timed out waiting for ${what}`);
  };
  return { page, moveTo, click, pause, type, spot, until, reloadUntil };
};

const nivoContext = async (viewport, dir) => {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, storageState, locale: "vi-VN", recordVideo: { dir, size: viewport } });
  await context.addCookies([{ name: "NIVO_LOCALE", value: "vi", url: base }]);
  await context.addInitScript(CURSOR);
  return context;
};

/** A recorded scene. `withTelegram` records a second, phone-sized Telegram Web video in parallel (split screen). */
/** SCENES=03,04 re-records only those scenes and merges them into an existing story.json in outDir (good takes are kept). */
const ONLY = process.env.SCENES ? new Set(process.env.SCENES.split(",").map((x) => x.trim())) : null;
const scene = async (nn, id, body, { withTelegram = false } = {}) => {
  if (ONLY && !ONLY.has(nn) && id !== "login") return;
  console.log(`scene ${nn} ${id}`);
  const tmp = join(outDir, `_tmp_${id}`);
  mkdirSync(tmp, { recursive: true });
  const context = await nivoContext(DESKTOP, tmp);
  let tgContext = null;
  let tg = null;
  if (withTelegram) {
    tgContext = await chromium.launchPersistentContext(TG_PROFILE, { headless: true, viewport: PHONE, recordVideo: { dir: tmp, size: PHONE } });
    await tgContext.addInitScript(CURSOR);
    // Privacy: the owner's personal chat list must never appear in a recording.
    await tgContext.addInitScript(() => {
      const hide = () => { const st = document.createElement("style"); st.textContent = "#LeftColumn,.chat-list,#chatlist-container{display:none!important}"; document.documentElement.appendChild(st); };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hide); else hide();
    });
    const tgPage = tgContext.pages()[0] ?? (await tgContext.newPage());
    tg = { ...helpersFor(tgPage), t0: Date.now() };
  }
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  current = { id, nn, t0: Date.now(), cues: [], telegram: withTelegram, page };
  if (tg) current.tgOffset = (current.t0 - tg.t0) / 1000; // the Telegram video started this many seconds earlier
  const h = helpersFor(page);
  try {
    await body(h, tg);
  } catch (e) {
    console.log(`  ERROR ${e.message.split("\n")[0]}`);
    current.error = e.message.split("\n")[0];
  }
  current.duration = (Date.now() - current.t0) / 1000;
  if (id === "login") storageState = await context.storageState();
  const video = page.video();
  const tgVideo = tg ? tg.page.video() : null;
  await context.close();
  if (tgContext) await tgContext.close();
  const keepLogin = id === "login" && ONLY && !ONLY.has(nn); // login only for the session; keep the old take
  if (video && !keepLogin) renameSync(await video.path(), join(outDir, `${nn}-${id}.webm`));
  if (tgVideo) renameSync(await tgVideo.path(), join(outDir, `${nn}-${id}-tg.webm`));
  if (keepLogin) return;
  story.scenes = story.scenes.filter((x) => x.nn !== nn);
  story.scenes.push({ nn, id, telegram: withTelegram, tgOffset: current.tgOffset ?? 0, duration: current.duration, cues: current.cues, focus: current.focus ?? [], clicks: current.clicks ?? [], error: current.error ?? null });
  story.scenes.sort((a, b) => a.nn.localeCompare(b.nn));
  writeFileSync(join(outDir, "story.json"), JSON.stringify(story, null, 2));
};

// ---- page helpers --------------------------------------------------------------------------------------------------------
const officeLog = (page) => page.getByRole("log").first();
const openCard = (page, needle) => officeLog(page).locator('[data-testid="exception-card"]').filter({ hasText: needle }).filter({ has: page.getByRole("button", { name: /Đồng ý để NIVO tiếp tục/ }) }).last();
const doneCard = (page, needle) => page.locator('[data-testid="exception-card"][data-status="done"]').filter({ hasText: needle });
const amountField = (scope) => scope.getByRole("textbox", { name: /Số tiền|Amount/ }).or(scope.getByRole("spinbutton", { name: /Số tiền|Amount/ })).first();

const pickSelect = async (h, label, option) => {
  const { page, click, pause } = h;
  const control = page.getByLabel(label, { exact: false }).first();
  const tag = await control.evaluate((el) => el.tagName).catch(() => "");
  if (tag === "SELECT") { await control.selectOption({ label: option }); return; }
  const trigger = page.getByRole("button", { name: label }).first();
  await click((await trigger.count()) ? trigger : control);
  await pause(500);
  await click(page.getByRole("option", { name: option, exact: true }).first());
  await pause(400);
};

/** Fill the /inbox simulator like a person would, narrating the channel. */
const simulate = async (h, input) => {
  const { page, click, type, pause, until } = h;
  await pickSelect(h, "Kênh", input.channel);
  await pickSelect(h, "Loại", input.kind);
  await type(page.getByLabel("Tên khách").first(), input.name);
  if (input.contact) await type(page.getByLabel("Điện thoại hoặc email").first(), input.contact);
  if (input.body) await type(page.getByLabel(/^Nội dung/).first(), input.body, 35);
  if (input.items) await type(page.getByLabel(/Hàng hóa|Dịch vụ/).first(), input.items, 35);
  if (input.amount != null) {
    const amount = amountField(page);
    await click(amount);
    await page.keyboard.press("Control+A");
    await page.keyboard.type(String(input.amount), { delay: 80 });
    await page.keyboard.press("Tab");
  }
  if (input.reference) await type(page.getByLabel("Mã tham chiếu").first(), input.reference, 40);
  await pause(900);
  await click(page.getByRole("button", { name: /Gửi vào NIVO/ }).first());
  const alert = page.locator('[role="alert"], [role="status"]').filter({ hasText: /Đã nhận|Trùng lặp/ }).first();
  await until("the simulator result", async () => alert.isVisible(), 45_000);
  return alert;
};

/** Telegram Web: open the bot chat in phone view (the personal chat list never shows) and send a message. */
const tgOpen = async (tg) => {
  await tg.page.goto("https://web.telegram.org/a/#?tgaddr=" + encodeURIComponent(`tg://resolve?domain=${BOT}`), { waitUntil: "domcontentloaded" });
  const input = tg.page.locator("#editable-message-text");
  const start = tg.page.getByRole("button", { name: /^(Start|Bắt đầu)$/i });
  await input.or(start).first().waitFor({ state: "visible", timeout: 60_000 });
  return { input, start };
};
const tgBubbles = (tg) => tg.page.locator(".message-list-item .text-content");
const tgSend = async (tg, text) => {
  const input = tg.page.locator("#editable-message-text");
  await tg.type(input, text, 45);
  await tg.pause(500);
  await tg.page.keyboard.press("Enter");
};
/** Wait for a new incoming (bot) bubble after `count` bubbles. */
const tgWaitReply = async (tg, count, timeoutMs = 60_000) => tg.until("the bot reply", async () => {
  const n = await tgBubbles(tg).count();
  if (n <= count) return false;
  const last = tgBubbles(tg).last();
  const incoming = await last.evaluate((el) => !el.closest(".message-list-item")?.classList.contains("own"));
  return incoming ? (await last.innerText()).trim() : false;
}, timeoutMs, 1000);

let chatbotId = null;

// ---- Telegram story v2: team (owner + chị Hà + AI), anh Minh on Telegram, bank credit appears by itself ---------------------
import { readFileSync as readFs } from "node:fs";
import { homedir } from "node:os";
const MINH_TG_PHONE = phone("77");
const secretsFile = join(homedir(), ".nivo-prototype", "secrets.env");
const envOf = (k) => { try { return (readFs(secretsFile, "utf8").match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? "").trim(); } catch { return ""; } };
const state = { lead: null, invoice: null };
const leadFlow = (page) => page.locator('[data-testid="lead-flow"]').first();
const minhConv = (page) => page.getByRole("button").filter({ hasText: /Minh/ }).filter({ hasText: /Telegram/ }).first();
const openMinhConv = async (h) => {
  const { page, reloadUntil } = h;
  await page.goto(`${base}/modules/${chatbotId}/chat?tab=customer`, { waitUntil: "networkidle" });
  await reloadUntil("Minh's Telegram conversation", async () => (await minhConv(page).count()) > 0, 45_000).catch(() => {});
  await minhConv(page).click().catch(() => {});
  await page.waitForTimeout(1200);
};
const openCase = async (h) => {
  const { page } = h;
  if (!state.lead) {
    await openMinhConv(h);
    const href = await page.locator('a[href^="/leads/"]').first().getAttribute("href").catch(() => null);
    if (href) state.lead = new URL(href, base).toString();
  }
  if (state.lead) await page.goto(state.lead, { waitUntil: "networkidle" });
  await leadFlow(page).waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
};
const ask = async (tg, text) => { const n = await tgBubbles(tg).count(); await tgSend(tg, text); await tgWaitReply(tg, n + 1, 60_000).catch(() => {}); await tg.pause(3000); };

await scene("00", "login", async ({ page, click }) => {
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  await click(page.getByRole("button", { name: /Dùng thử ngay|Try NIVO now|demo/i }).first());
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90_000 });
});
{
  const ctx = await nivoContext(DESKTOP, join(outDir, "_scratch"));
  const p = await ctx.newPage();
  await p.goto(base + "/modules", { waitUntil: "networkidle" });
  const hrefs = await p.locator('a[href*="/modules/"][href$="/chat"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("href")))]);
  for (const href of hrefs) {
    const id = href?.match(/\/modules\/([^/]+)\/chat/)?.[1];
    if (!id) continue;
    await p.goto(`${base}/modules/${id}/chat?tab=customer`, { waitUntil: "networkidle" });
    if (await p.getByRole("tab", { name: /Website chat/ }).count()) { chatbotId = id; break; }
  }
  await ctx.close();
}

// 1 — Đội ngũ và giao quyền
await scene("01", "doi-ngu", async (h) => {
  const { page, type, click, spot, pause } = h;
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  await pause(1200);
  cue("Ở Spa Hoa Mai, cả đội làm việc trong một nhóm chung: chủ spa, chị Hà tư vấn viên, và các nhân viên AI.", "Một nhóm: người + AI");
  await spot(page.getByText("Chị Hà").first(), 4000);
  cue("Sáng nay, chủ spa nhắn cho NIVO đúng một lần.", "Bước 1 · Giao quyền");
  await type(page.getByRole("textbox", { name: /Tin nhắn/ }).last(), "@nivo Chatbot cứ tư vấn và chốt đơn theo bảng giá. Đơn dưới 20 triệu thì tự xác nhận. Ưu đãi hay việc chưa chắc thì hỏi chị Hà.", 36);
  cue("Cứ tư vấn và chốt đơn theo bảng giá, đơn dưới hai mươi triệu thì tự xác nhận, việc gì chưa chắc thì hỏi chị Hà.", "Bước 1 · Giao quyền");
  const confirmations = () => officeLog(page).getByText(/Đã lưu quyền bạn giao|Tôi chưa thấy quyền|Không có thay đổi/);
  const before = await confirmations().count();
  await click(page.getByRole("button", { name: /^Gửi$/ }).last());
  // Wait for THIS message's confirmation (a new one), not an older one with the same words.
  await h.until("NIVO's new confirmation", async () => (await confirmations().count()) > before, 60_000).catch(() => {});
  await page.waitForTimeout(800);
  cue("NIVO ghi nhớ thành quy tắc.", "Quy tắc đã lưu");
  await spot(confirmations().last(), 3500);
});

// 2 — Tư vấn
await scene("02", "tu-van", async (h, tg) => {
  const { page, spot } = h;
  await page.goto(`${base}/modules/${chatbotId}/chat?tab=customer`, { waitUntil: "networkidle" });
  const { start } = await tgOpen(tg);
  cue("Buổi trưa, anh Minh nhắn cho spa qua Telegram: dạo này hay mỏi cổ vai gáy, ngủ không ngon.", "Bước 2 · Khách nhắn tới");
  if (await start.isVisible().catch(() => false)) await tg.click(start); else await tgSend(tg, "/start");
  await tgWaitReply(tg, 0, 30_000).catch(() => {});
  await tg.pause(1200);
  await ask(tg, "Chào em, anh là Minh. Dạo này anh hay mỏi cổ vai gáy, tối ngủ không ngon. Bên mình có dịch vụ nào hợp không em?");
  cue("Trợ lý của spa hỏi han, rồi gợi ý gói gội đầu dưỡng sinh.", "Tư vấn theo nhu cầu");
  await ask(tg, "Một buổi gồm những gì, làm bao lâu vậy em?");
  cue("Giải thích một buổi gồm những gì, rồi báo giá năm triệu cho mười buổi, như một nhân viên tư vấn thật.", "Như một nhân viên thật");
  await ask(tg, "Gói 10 buổi giá bao nhiêu em?");
  await openMinhConv(h);
  cue("Chủ spa chưa phải trả lời câu nào.", "Hội thoại hiện trong NIVO");
  await spot(page.getByRole("log").filter({ hasText: /cổ vai gáy/ }).first(), 3500);
}, { withTelegram: true });

// 3 — Việc cần người: Chatbot hỏi chị Hà, chị Hà trả lời trong nhóm, Chatbot chuyển lời cho khách
await scene("03", "hoi-chi-ha", async (h, tg) => {
  const { page, click, type, spot, pause, reloadUntil } = h;
  await tgOpen(tg);
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  cue("Anh Minh hỏi thêm: khách mới có ưu đãi gì không.", "Việc cần người");
  await ask(tg, "Anh là khách mới, bên em có ưu đãi gì không?");
  cue("Ưu đãi là lời hứa với khách, nên trợ lý không tự trả lời. Nó nhắn anh Minh chờ một chút, rồi hỏi chị Hà trong nhóm.", "Chatbot tag chị Hà");
  await reloadUntil("the Chatbot tagging Hà", async () => /@ha ơi/.test(await officeLog(page).innerText()), 60_000).catch(() => {});
  await spot(officeLog(page).getByText(/@ha ơi/).last(), 4000);
  const asBtn = page.getByRole("button", { name: /tư cách|Nhắn với|Send as/i }).first();
  if (await asBtn.isVisible().catch(() => false)) {
    await click(asBtn);
    await pause(500);
    await page.getByRole("menuitemradio", { name: /Chị Hà/ }).first().click().catch(() => {});
    await page.getByText(/Đang nhắn với tư cách Chị Hà/).first().waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  }
  cue("Chị Hà trả lời ngay trong nhóm.", "Chị Hà trả lời");
  await type(page.getByRole("textbox", { name: /Tin nhắn/ }).last(), "Khách mới được tặng thêm một buổi massage cổ vai gáy 30 phút nhé em.", 40);
  await click(page.getByRole("button", { name: /^Gửi$/ }).last());
  const tgBefore = await tgBubbles(tg).count();
  cue("Trợ lý chuyển lời chị Hà thành câu trả lời gửi anh Minh. Khách vẫn chỉ nói chuyện với một đầu mối.", "Chatbot chuyển lời cho khách");
  await reloadUntil("the relay confirmation", async () => /Em đã gửi/.test(await officeLog(page).innerText()), 60_000).catch(() => {});
  await tgWaitReply(tg, tgBefore, 45_000).catch(() => {});
  await tg.pause(4000);
}, { withTelegram: true });

// 4 — Chốt đơn
await scene("04", "chot-don", async (h, tg) => {
  const { page, spot, reloadUntil } = h;
  await tgOpen(tg);
  await openMinhConv(h); // NIVO side shows the live conversation while the customer confirms
  cue("Anh Minh chốt gói.", "Bước 3 · Chốt đơn");
  await ask(tg, `Ok em, anh lấy gói gội đầu dưỡng sinh 10 buổi nhé. Anh tên Minh, SĐT ${MINH_TG_PHONE}.`);
  await openCase(h);
  await page.getByText(/Đang tải/).first().waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});
  cue("Đơn nằm trong quyền đã giao, nên NIVO tự xác nhận và lập hồ sơ thanh toán.", "5 triệu < 20 triệu → tự xác nhận");
  await reloadUntil("the payment record", async () => (await leadFlow(page).locator('[data-testid="flow-invoice"]').count()) > 0, 60_000).catch(() => {});
  state.invoice = ((await leadFlow(page).locator('[data-testid="flow-invoice"]').first().innerText().catch(() => "")).match(/INV-\d+-\d+/) ?? [null])[0];
  await spot(leadFlow(page).locator('[data-testid="flow-invoice"]').first(), 3500);
  cue("Rồi gửi anh số tài khoản Vietcombank của spa, kèm mã hồ sơ để ghi nội dung chuyển khoản.", "Gửi thông tin chuyển khoản");
  await tg.pause(4500);
}, { withTelegram: true });

// 5 — Tiền về, tự khớp (the bank credit arrives by itself through the connector endpoint; nothing is typed in NIVO)
await scene("05", "tien-ve", async (h, tg) => {
  const { page, spot, reloadUntil } = h;
  await tgOpen(tg);
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  cue("Vài phút sau, tiền về tài khoản Vietcombank của spa.", "Bước 4 · Tiền về");
  const tgBefore = await tgBubbles(tg).count();
  await fetch(`${base}/api/bank/vietcombank`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-nivo-bank-secret": envOf("BANK_WEBHOOK_SECRET") },
    body: JSON.stringify({ amount_vnd: 5_000_000, content: `${state.invoice ?? ""} NGUYEN VAN MINH CK`, sender_name: "NGUYEN VAN MINH", event_id: `vcb-${Date.now()}` }),
  }).catch(() => null);
  await reloadUntil("the Vietcombank credit in Office", async () => /Vietcombank báo có/.test(await officeLog(page).innerText()), 60_000).catch(() => {});
  cue("NIVO thấy ngay giao dịch báo có, đúng số tiền, đúng mã hồ sơ, nên tự ghi nhận đã thanh toán.", "Khớp mã hồ sơ + số tiền");
  const matched = () => officeLog(page).locator("p, div").filter({ hasText: "Vietcombank báo có" }).filter({ hasText: state.invoice ?? "INV-" }).filter({ hasText: "Đã khớp" }).last();
  await reloadUntil("the matched credit", async () => (await matched().count()) > 0, 45_000).catch(() => {});
  await spot(matched(), 4000);
  cue("Và gửi anh Minh lời cảm ơn cùng lịch hẹn buổi đầu.", "Khách nhận xác nhận trên Telegram");
  await tgWaitReply(tg, tgBefore, 60_000).catch(() => {});
  await tg.pause(4500);
}, { withTelegram: true });

// 6 — Cuối ngày
await scene("06", "ket-qua", async (h) => {
  const { page, spot, pause } = h;
  await openCase(h);
  cue("Cuối ngày, hồ sơ anh Minh đủ cả: cuộc tư vấn, đơn hàng, khoản tiền đã khớp.", "Bước 5 · Xem kết quả");
  await spot(leadFlow(page).locator('[data-testid="flow-invoice"]').first(), 3500);
  cue("Và câu trả lời ưu đãi do chị Hà quyết.", "Ai quyết, lúc nào");
  await spot(leadFlow(page).locator('[data-testid="flow-decision"]').filter({ hasText: /Hà/ }).first(), 3500);
  cue("Chủ spa chỉ giao quyền buổi sáng. Chị Hà trả lời đúng một câu. Phần còn lại, NIVO lo.", "Người quyết · AI làm");
  await pause(4000);
});

await browser.close();
writeFileSync(join(outDir, "story.json"), JSON.stringify(story, null, 2));
console.log(`Telegram story v2 recorded → ${outDir} (${story.scenes.filter((s) => s.error).length} scene errors)`);
