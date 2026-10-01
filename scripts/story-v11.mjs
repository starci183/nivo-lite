#!/usr/bin/env node
// V1.1 (founder-edited) story recording: one case file (anh Minh) from order to verified sample payment.
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
/** A narration line (read verbatim from the founder's V1.1 script) + the on-screen chip shown with it. */
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

const state = { minhLead: null };
const leadFlow = (page) => page.locator('[data-testid="lead-flow"]').first();
const openMinh = async (h) => {
  const { page, reloadUntil } = h;
  if (!state.minhLead) {
    // The leads search matches names, not phone numbers: newest "Anh Minh" first (the simulator result link is preferred).
    await page.goto(`${base}/leads?q=${encodeURIComponent("Anh Minh")}`, { waitUntil: "networkidle" });
    const href = await reloadUntil("anh Minh's case", async () => {
      const link = page.locator('a[href^="/leads/"]').filter({ hasText: "Anh Minh" }).first();
      return (await link.count()) ? link.getAttribute("href") : null;
    }, 60_000).catch(() => null);
    if (href) state.minhLead = new URL(href, base).toString();
  }
  if (state.minhLead) await page.goto(state.minhLead, { waitUntil: "networkidle" });
  await leadFlow(page).waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
};

// ============================================================================================================================
// Login once for the session (not part of the cut: V1.1 drops the login/UI tour).
await scene("00", "login", async ({ page, click }) => {
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  await click(page.getByRole("button", { name: /Dùng thử ngay|Try NIVO now|demo/i }).first());
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90_000 });
});

// Chatbot id (Telegram conversations live on the Chatbot page).
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

// 03 — Giao việc
await scene("03", "giao-viec", async ({ page, type, click, spot, pause, reloadUntil }) => {
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  await pause(1500);
  cue("Chủ spa giao việc bằng lời thường: theo giúp tôi hồ sơ đặt gói của anh Minh.", "Bước 1 — Giao quyền");
  await type(page.getByRole("textbox", { name: /Tin nhắn/ }).last(), "@nivo Theo giúp tôi hồ sơ đặt gói của anh Minh. Sales được tự xác nhận đơn dưới 20 triệu. Chưa rõ khách chuyển tiền thì hỏi tôi.", 38);
  cue("Sales được tự xác nhận đơn dưới hai mươi triệu. Với khoản tiền chưa rõ khách, phải hỏi trước khi gắn vào hồ sơ.", "Bước 1 — Giao quyền");
  await click(page.getByRole("button", { name: /^Gửi$/ }).last());
  await reloadUntil("NIVO's confirmation", async () => /Đã lưu quyền bạn giao|Tôi chưa thấy quyền/.test(await officeLog(page).innerText()), 60_000).catch(() => {});
  cue("Chủ spa giữ mục tiêu và giới hạn; NIVO thực hiện trong phạm vi được giao.", "Mục tiêu • Giới hạn • Người chịu trách nhiệm");
  await spot(officeLog(page).getByText(/Đã lưu quyền bạn giao|Tôi chưa thấy quyền/).last(), 4500);
});

// 04 — Kiểm tra quyền
await scene("04", "kiem-tra-quyen", async ({ page, spot, pause }) => {
  await page.goto(base + "/authority", { waitUntil: "networkidle" });
  await page.getByText("Xác nhận đơn hàng").first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
  cue("Trước khi chạy, chủ spa kiểm tra lại quy tắc đã lưu.", "Kiểm tra quy tắc đã lưu");
  await spot(page.getByText("Xác nhận đơn hàng").first(), 3500);
  cue("Dưới hai mươi triệu khác với tối đa hai mươi triệu. Đúng hai mươi triệu cần được làm rõ trước khi cấp quyền.", "Điểm biên: phải xác định rõ");
  await pause(4500);
  cue("Kế toán có giới hạn riêng; duyệt một đơn hàng không tự động duyệt mọi hành động tiếp theo.", "Quyền được xét theo từng hành động");
  await spot(page.getByText("Xuất hóa đơn").first(), 4500);
});

// 05 — Ranh giới kết nối (Telegram, verified live in this recording → the founder's E line for a passed check)
await scene("05", "telegram", async ({ page, spot, reloadUntil }, tg) => {
  await page.goto(`${base}/modules/${chatbotId}/chat?tab=customer`, { waitUntil: "networkidle" });
  const { start } = await tgOpen(tg);
  cue("Trước khi theo hồ sơ anh Minh, hãy nhìn cách đầu vào đi vào NIVO.", "Bước 2 — Nhận đầu vào");
  await tg.pause(2500);
  if (await start.isVisible().catch(() => false)) await tg.click(start); else await tgSend(tg, "/start");
  await tgWaitReply(tg, 0, 30_000).catch(() => {});
  const n1 = await tgBubbles(tg).count();
  cue("Chị Lan đang đóng vai khách nhắn qua Telegram.", "Telegram: kiểm chứng kết nối trong lần quay");
  await tgSend(tg, `Chào shop, mình là Lan, muốn hỏi gói chăm sóc da 5 buổi. Số mình ${LAN_PHONE}.`);
  await tgWaitReply(tg, n1 + 1, 60_000).catch(() => {});
  cue("Trong lần quay này, tin nhắn đi vào NIVO và phản hồi trở lại đúng cuộc trò chuyện.", "Telegram: kiểm chứng kết nối trong lần quay");
  const lanRow = () => page.getByRole("button").filter({ hasText: /Lan/ }).filter({ hasText: /Telegram/ }).first();
  await reloadUntil("Lan's conversation", async () => (await lanRow().count()) > 0, 45_000).catch(() => {});
  await page.waitForTimeout(800);
  await lanRow().click().catch(() => {});
  await spot(page.getByRole("log").filter({ hasText: /Lan/ }).first(), 4000);
  cue("Đây là kết nối live với dữ liệu mẫu; chưa phải một case khách hàng thật.", "Nhân vật và dữ liệu mẫu");
  await tg.pause(4000);
}, { withTelegram: true });

// 06 — Nhận hồ sơ chính (Zalo simulated)
await scene("06", "nhan-ho-so", async (h) => {
  const { page, spot, pause } = h;
  await page.goto(base + "/inbox", { waitUntil: "networkidle" });
  cue("Với anh Minh, bản MVP trong tài liệu dùng trang Đầu vào để mô phỏng tin Zalo.", "Đầu vào Zalo mô phỏng");
  await spot(page.getByText(/Kênh mô phỏng/).first(), 3500);
  cue("Anh đặt gói gội đầu dưỡng sinh mười buổi, năm triệu đồng.", "Anh Minh • 10 buổi • 5.000.000 đ");
  const result = await simulate(h, { channel: "Zalo", kind: "Đơn hàng", name: "Anh Minh", contact: MINH_PHONE, items: "Gói gội đầu dưỡng sinh 10 buổi", amount: 5_000_000, reference: REF_MINH });
  // The result line links straight to the case NIVO opened for this input.
  const link = page.locator('a[href^="/leads/"]').filter({ hasText: /Mở khách hàng|Open customer|Anh Minh/ }).first();
  await link.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
  const href = await link.getAttribute("href").catch(() => null);
  if (href) state.minhLead = new URL(href, base).toString();
  void result;
  await pause(2500);
  await openMinh(h);
  cue("Từ đây, chúng ta giữ cùng một hồ sơ để theo được đơn hàng, khoản phải thanh toán và quyết định liên quan.", "Anh Minh — giữ cùng một hồ sơ");
  await spot(page.getByRole("heading").filter({ hasText: /Anh Minh/ }).first(), 4000);
});

// 07 — Xử lý thường lệ
await scene("07", "xu-ly-thuong-le", async (h) => {
  const { page, spot, reloadUntil } = h;
  await openMinh(h);
  cue("Đơn năm triệu nằm dưới ngưỡng Sales được tự xác nhận.", "Bước 3 — Thực thi trong phạm vi • Đơn 5 triệu < ngưỡng 20 triệu");
  await reloadUntil("the confirmed order", async () => (await leadFlow(page).locator('[data-testid="flow-order"]').count()) > 0, 60_000).catch(() => {});
  await spot(leadFlow(page).locator('[data-testid="flow-work-item"]').filter({ hasText: /Xác nhận đơn/ }).first(), 4000);
  cue("Trong luồng được mô tả, nhân viên số xử lý đơn trong phạm vi đó.", "Bước 3 — Thực thi trong phạm vi");
  await spot(leadFlow(page).locator('[data-testid="flow-order"]').first(), 4000);
  cue("Điều cần nhìn trên màn hình là trạng thái đơn và hồ sơ liên quan, thay vì chỉ một tin nhắn báo đã xong.", "Kiểm tra trạng thái đơn");
  await h.pause(4000);
});

// 08 — Bàn giao thanh toán
await scene("08", "ho-so-thanh-toan", async (h) => {
  const { page, spot, reloadUntil } = h;
  await openMinh(h);
  cue("Tiếp theo là hồ sơ thanh toán của anh Minh.", "Hồ sơ thanh toán nội bộ");
  await reloadUntil("the payment record", async () => (await leadFlow(page).locator('[data-testid="flow-invoice"]').count()) > 0, 60_000).catch(() => {});
  await spot(leadFlow(page).locator('[data-testid="flow-invoice"]').first(), 4000);
  cue("Trong bản này, chúng ta chỉ xác nhận bản ghi nội bộ được tạo và gắn đúng đơn. Chưa có bằng chứng phát hành hóa đơn qua hệ thống bên ngoài.", "Bản ghi nội bộ — chưa xác minh phát hành");
  await h.pause(5000);
  cue("Đơn đã xác nhận cũng chưa có nghĩa là đã thu tiền.", "Xác nhận đơn ≠ đã thanh toán");
  await h.pause(3500);
});

// 09 — Trạng thái chờ
await scene("09", "trang-thai-cho", async (h) => {
  const { page, spot } = h;
  await openMinh(h);
  cue("Đến đây, ta biết hồ sơ của anh Minh đã đi tới đâu và còn thiếu điều gì.", "Đang chờ: xác minh thanh toán");
  await spot(leadFlow(page), 4000);
  cue("Mục tiêu chưa hoàn tất: cần xác minh khoản thanh toán. Có một bản ghi là chưa đủ.", "Đang chờ: xác minh thanh toán");
  await spot(leadFlow(page).locator('[data-testid="flow-invoice"]').first(), 4000);
  cue("NIVO cần giúp chủ spa nhìn được việc còn đang chờ, để tránh kết luận quá sớm.", "Chú giải trạng thái");
  await h.pause(3500);
});

// 10 — Ngoại lệ: báo có không rõ
await scene("10", "ngoai-le", async (h) => {
  const { page, spot, pause, reloadUntil } = h;
  await page.goto(base + "/inbox", { waitUntil: "networkidle" });
  cue("Một báo có năm triệu xuất hiện, nhưng nội dung chỉ ghi chuyển tiền. Đây là dữ liệu ngân hàng mô phỏng.", "Bước 4 — Xử lý ngoại lệ • Ngân hàng mô phỏng");
  await simulate(h, { channel: "Ngân hàng", kind: "Thanh toán", name: "Người chuyển khoản", amount: 5_000_000, reference: `CK chuyen tien ${rnd}` });
  await pause(1500);
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  const card = () => officeLog(page).locator('[data-testid="exception-card"]').filter({ hasText: new RegExp(rnd) }).last();
  await reloadUntil("the unclear payment card", async () => (await card().count()) > 0, 60_000).catch(() => {});
  cue("Cùng số tiền chưa đủ để biết chắc là của anh Minh.", "Chưa rõ người chuyển → chờ xác minh");
  await spot(card(), 4500);
  cue("NIVO cần dừng việc gắn khoản tiền và đưa câu hỏi này về người có căn cứ quyết định.", "Chưa rõ người chuyển → chờ xác minh");
  await pause(3500);
});

// 11 — Quyết định có căn cứ
await scene("11", "quyet-dinh", async (h) => {
  const { page, click, type, spot, pause, reloadUntil } = h;
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  const card = () => officeLog(page).locator('[data-testid="exception-card"]').filter({ hasText: new RegExp(rnd) }).last();
  await reloadUntil("the unclear payment card", async () => (await card().count()) > 0, 60_000).catch(() => {});
  await card().scrollIntoViewIfNeeded().catch(() => {});
  cue("Trong tình huống mẫu, chủ spa đã kiểm tra và xác nhận khoản này thuộc anh Minh.", "Quyết định của chủ spa • Căn cứ trong tình huống mẫu");
  const minh = card().getByRole("radio").filter({ hasText: /Minh/ });
  await click((await minh.count()) ? minh.first() : card().getByRole("radio").first()).catch(() => {});
  const basis = card().getByRole("textbox", { name: /Căn cứ/i }).first();
  if (await basis.isVisible().catch(() => false)) await type(basis, "Tình huống mẫu: đã đối chiếu, anh Minh gửi ảnh chuyển khoản 5.000.000 đ", 30);
  cue("Chị chọn đúng hồ sơ rồi duyệt việc gắn khoản thanh toán.", "Anh Minh • 5.000.000 đ • Gắn khoản thanh toán");
  await pause(1200);
  await click(card().getByRole("button", { name: /Đồng ý để NIVO tiếp tục/ }).first()).catch(() => {});
  cue("Nếu chưa có căn cứ, việc phải tiếp tục chờ. Một gợi ý của hệ thống giúp tìm nhanh hơn, nhưng không thay bằng chứng.", "Căn cứ trong tình huống mẫu");
  const done = () => page.locator('[data-testid="exception-card"][data-status="done"]').filter({ hasText: new RegExp(rnd) }).first();
  await reloadUntil("the decided card", async () => (await done().count()) > 0, 45_000).catch(() => {});
  await spot(done(), 4500);
});

// 12 — Tiếp tục đúng việc
await scene("12", "tiep-tuc", async (h) => {
  const { page, spot, reloadUntil } = h;
  await openMinh(h);
  cue("Sau quyết định, luồng xử lý tiếp tục trên đúng hồ sơ anh Minh.", "Cùng hồ sơ — tiếp tục sau duyệt");
  await reloadUntil("the paid sample payment", async () => (await leadFlow(page).locator('[data-testid="flow-invoice"][data-status="paid"]').count()) > 0, 45_000).catch(() => {});
  await spot(leadFlow(page).locator('[data-testid="flow-invoice"]').first(), 4000);
  cue("Trạng thái thanh toán mẫu được cập nhật theo báo có mô phỏng và xác nhận của chủ spa.", "Thanh toán mẫu được xác nhận");
  await spot(leadFlow(page).locator('[data-testid="flow-decision"]').first(), 4000);
  cue("Đây là kết quả xử lý trong lần demo; chưa chứng minh đã nhận năm triệu ngoài đời thực.", "Không phải giao dịch ngân hàng thật");
  await h.pause(3500);
});

// 13 — Hành động và gửi
await scene("13", "cam-on", async (h) => {
  const { page, spot, reloadUntil } = h;
  await openMinh(h);
  cue("Tài liệu còn mô tả bước Sales gửi lời cảm ơn sau thanh toán.", "Zalo mô phỏng");
  const care = () => leadFlow(page).locator('[data-testid="flow-work-item"]').filter({ hasText: /chăm sóc|cảm ơn/i }).first();
  await reloadUntil("the care step", async () => (await care().count()) > 0, 45_000).catch(() => {});
  await spot(care(), 4000);
  cue("Vì Zalo chưa được kết nối live trong demo này, ta chỉ xem được phần ghi nhận nội bộ nếu có.", "Zalo mô phỏng");
  await h.pause(3500);
  cue("Tạo nội dung, gửi đi và khách nhận được là ba kết quả khác nhau.", "Ghi nhận nội bộ ≠ khách đã nhận tin");
  await h.pause(3500);
});

// 14 — Kết quả có căn cứ
await scene("14", "ket-qua", async ({ page, spot, pause }) => {
  await page.goto(base + "/dashboard", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Kết quả/ }).first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
  await pause(1000);
  cue("Cuối vòng, chủ spa cần xem ba điều: việc nào đã xử lý, căn cứ nằm ở đâu và việc nào còn chờ.", "Bước 5 — Kiểm chứng kết quả");
  await spot(page.getByRole("heading", { name: /Kết quả/ }).first(), 4000);
  await page.goto(base + "/decisions", { waitUntil: "networkidle" });
  await page.getByText("Anh Minh").first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
  cue("Với anh Minh, đó là trạng thái đơn, hồ sơ thanh toán nội bộ và quyết định xác nhận khoản tiền mẫu.", "Đơn • Thanh toán mẫu • Căn cứ • Việc còn chờ");
  await spot(page.getByText("Anh Minh").first(), 4500);
  cue("Mười buổi dịch vụ vẫn chưa hoàn thành. Video cũng chưa xác nhận doanh thu đã ghi nhận.", "Dịch vụ chưa hoàn thành; doanh thu chưa xác nhận");
  await pause(4000);
});

await browser.close();
writeFileSync(join(outDir, "story.json"), JSON.stringify(story, null, 2));
console.log(`V1.1 story recorded → ${outDir} (${story.scenes.filter((s) => s.error).length} scene errors)`);
