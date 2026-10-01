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
const cue = (text) => {
  const t = (Date.now() - current.t0) / 1000;
  current.cues.push({ t, text });
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

// =============================================================================================================================
await scene("00", "login", async ({ page, click, pause }) => {
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  cue("Đây là trang đăng nhập của NIVO. Chúng ta vào bằng tài khoản dùng thử của Spa Hoa Mai.");
  await pause(3500);
  await click(page.getByRole("button", { name: /Dùng thử ngay|Try NIVO now|demo/i }).first());
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90_000 });
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  cue("Vào trong là Office: một khung chat chung, giống Zalo, giữa chủ spa và các nhân viên AI.");
  await pause(4000);
});

await scene("01", "office", async ({ page, spot, pause }) => {
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  await pause(1500);
  cue("Bên trái là danh sách trò chuyện: nhóm Office, các nhân viên AI như Sales, Kế toán, Chatbot, và khách hàng gần đây.");
  await spot(page.getByRole("button", { name: /Office/ }).or(page.getByText("Trò chuyện")).first(), 3500);
  cue("Ở giữa là cuộc trò chuyện. Ô nhập tin nhắn luôn nằm ở dưới cùng, bấm là gõ được ngay.");
  await spot(page.getByRole("textbox", { name: /Tin nhắn/ }).last(), 3500);
  cue("Bên phải là những việc đang chờ chủ spa quyết định, và danh sách thành viên.");
  await spot(page.getByText("Thông tin nhóm").first(), 3000);
});

await scene("02", "giao-quyen", async ({ page, type, click, spot, pause, reloadUntil }) => {
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  await pause(1500);
  cue("Bước một: giao quyền. Chủ spa chỉ cần nhắn cho NIVO bằng lời bình thường, như nhắn cho một quản lý.");
  await pause(1500);
  const text = "@nivo Giao quyền: Chatbot tự tư vấn và chuyển khách cho Sales. Sales tự xác nhận đơn hàng dưới 20 triệu, đơn trên 20 triệu thì hỏi tôi.";
  cue("Ví dụ: Sales được tự xác nhận đơn dưới hai mươi triệu, đơn lớn hơn thì phải hỏi chủ spa trước.");
  await type(page.getByRole("textbox", { name: /Tin nhắn/ }).last(), text, 38);
  await pause(800);
  await click(page.getByRole("button", { name: /^Gửi$/ }).last());
  cue("NIVO đọc tin nhắn, hiểu thành quy tắc, lưu lại, rồi trả lời xác nhận ngay trong khung chat.");
  await reloadUntil("NIVO's confirmation", async () => /Đã lưu quyền bạn giao/.test(await officeLog(page).innerText()), 60_000).catch(() => {});
  await spot(officeLog(page).getByText(/Đã lưu quyền bạn giao/).last(), 4500);
  await page.goto(base + "/authority", { waitUntil: "networkidle" });
  cue("Mở trang Giao quyền để kiểm tra: quy tắc Xác nhận đơn hàng đã là Tự động, hạn mức hai mươi triệu đồng.");
  await pause(1500);
  await spot(page.getByText("Xác nhận đơn hàng").first(), 4500);
  cue("Ở đây chủ spa cũng đặt được mục tiêu, chính sách, và những việc luôn phải hỏi trước.");
  await pause(3500);
});

// Chatbot id (the Chatbot's customer channel lives on its page).
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
  console.log(`chatbot ${chatbotId}`);
}

await scene("03", "telegram-lan", async (h, tg) => {
  const { page, spot, pause, reloadUntil } = h;
  await page.goto(`${base}/modules/${chatbotId}/chat?tab=customer`, { waitUntil: "networkidle" });
  const { start } = await tgOpen(tg);
  cue("Bước hai: NIVO nhận đầu vào. Đây là chị Lan, khách của spa, nhắn tới qua Telegram. Kênh Telegram này là kênh thật, đã kết nối với NIVO.");
  await tg.pause(3500);
  if (await start.isVisible().catch(() => false)) { await tg.click(start); } else { await tgSend(tg, "/start"); }
  cue("Chị Lan bấm bắt đầu. Chatbot AI của spa chào chị ngay lập tức.");
  await tgWaitReply(tg, 0, 30_000).catch(() => {});
  await tg.pause(2500);
  const n1 = await tgBubbles(tg).count();
  cue("Chị Lan nhắn: muốn đặt liệu trình chăm sóc da năm buổi, và để lại số điện thoại.");
  await tgSend(tg, `Chào shop, mình là Lan, muốn đặt liệu trình chăm sóc da 5 buổi. Số mình ${LAN_PHONE}, shop gọi lại giúp mình nhé.`);
  cue("Chatbot AI trả lời chị Lan ngay trên Telegram. Đây là câu trả lời thật do AI viết.");
  await tgWaitReply(tg, n1 + 1, 60_000).catch(() => {});
  await tg.pause(3000);
  cue("Cùng lúc đó, bên trong NIVO, cuộc trò chuyện Telegram của chị Lan hiện ra trong trang Chatbot. NIVO tự nhận ra tên khách là Lan.");
  const lanRow = () => page.getByRole("button").filter({ hasText: /Lan/ }).filter({ hasText: /Telegram/ }).first();
  await reloadUntil("Lan's Telegram conversation", async () => (await lanRow().count()) > 0, 45_000).catch(() => {});
  await spot(lanRow(), 2500);
  await h.click(lanRow()).catch(() => {});
  await pause(2500);
  cue("Vì chị Lan đã nói rõ nhu cầu và để lại số điện thoại, Chatbot tự chuyển chị cho Sales AI, đúng theo quyền đã giao. Không cần hỏi chủ spa.");
  await spot(page.getByText(/Đã chuyển lead cho Sales AI/).first(), 4500).catch(() => pause(3000));
  const n2 = await tgBubbles(tg).count();
  cue("Chị Lan hỏi tiếp: liệu trình giá bao nhiêu, và khách mới có được giảm giá không.");
  await tgSend(tg, "Liệu trình này giá bao nhiêu vậy shop? Khách mới có được giảm không?");
  cue("Giá niêm yết thì AI biết từ bảng giá chủ spa đã khai báo. Nhưng giảm giá là một lời hứa với khách, nằm ngoài quyền của Chatbot. Nên AI hẹn chị Lan, và gửi đề xuất cho chủ spa duyệt.");
  await tgWaitReply(tg, n2 + 1, 60_000).catch(() => {});
  await tg.pause(3500);
  await reloadUntil("the needs-human notice", async () => (await page.getByText(/cần người duyệt/).count()) > 0, 30_000).catch(() => {});
  await spot(page.getByText(/cần người duyệt/).last(), 4000).catch(() => pause(3000));
}, { withTelegram: true });

await scene("04", "duyet-tra-loi", async ({ page, click, spot, pause, reloadUntil }, tg) => {
  await tgOpen(tg);
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  cue("Chủ spa mở Office. Câu hỏi về giá của chị Lan đang nằm trong khung chat, dưới dạng một thẻ cần quyết định.");
  const card = () => openCard(page, /giảm|giá bao nhiêu/);
  await reloadUntil("the price question card", async () => (await card().count()) > 0, 60_000).catch(() => {});
  await spot(card(), 4000).catch(() => pause(3000));
  cue("Trên thẻ có câu trả lời NIVO đề xuất. Chủ spa đọc, thấy ổn, và bấm Đồng ý để NIVO tiếp tục.");
  await pause(2500);
  const tgBefore = await tgBubbles(tg).count();
  await click(card().getByRole("button", { name: /Đồng ý để NIVO tiếp tục/ }).first()).catch(() => {});
  cue("Ngay sau khi duyệt, NIVO gửi câu trả lời đó tới chị Lan trên Telegram. Chủ spa không phải gõ lại gì.");
  await tgWaitReply(tg, tgBefore, 45_000).catch(() => {});
  await tg.pause(4000);
  await pause(2000);
}, { withTelegram: true });

await scene("05", "zalo-minh", async (h) => {
  const { page, spot, pause, reloadUntil } = h;
  await page.goto(base + "/inbox", { waitUntil: "networkidle" });
  cue("Tiếp theo là anh Minh, khách quen, nhắn qua Zalo. Bản dùng thử chưa kết nối Zalo thật, nên tin Zalo được mô phỏng ở trang Đầu vào này.");
  await spot(page.getByText(/Kênh mô phỏng/).first(), 4500).catch(() => pause(3000));
  cue("Anh Minh đặt gói gội đầu dưỡng sinh mười buổi, giá năm triệu đồng.");
  await simulate(h, { channel: "Zalo", kind: "Đơn hàng", name: "Anh Minh", contact: MINH_PHONE, items: "Gói gội đầu dưỡng sinh 10 buổi", amount: 5_000_000, reference: REF_MINH });
  cue("NIVO nhận đơn, kiểm tra không bị trùng, rồi chuyển cho Sales AI.");
  await pause(3500);
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  cue("Đơn năm triệu nằm trong hạn mức hai mươi triệu, nên Sales AI tự xác nhận đơn, và Kế toán AI tự xuất hóa đơn. NIVO báo lại trong Office.");
  await reloadUntil("NIVO's auto report for Minh", async () => (await officeLog(page).getByText(new RegExp(REF_MINH)).count()) > 0, 60_000).catch(() => {});
  await spot(officeLog(page).getByText(new RegExp(REF_MINH)).last(), 4500).catch(() => pause(3000));
  cue("Việc thường lệ như vậy, chủ spa không cần làm gì cả.");
  await pause(3000);
});

await scene("06", "vuot-quyen", async (h) => {
  const { page, click, spot, pause, reloadUntil } = h;
  await page.goto(base + "/inbox", { waitUntil: "networkidle" });
  cue("Bước bốn: khi nào NIVO phải hỏi. Công ty Ánh Dương đặt qua Facebook, cũng là mô phỏng, gói chăm sóc sức khỏe cho ba mươi nhân viên, bốn mươi lăm triệu đồng.");
  await simulate(h, { channel: "Facebook", kind: "Đơn hàng", name: "Công ty Ánh Dương", contact: AD_PHONE, items: "Gói chăm sóc sức khỏe cho 30 nhân viên", amount: 45_000_000, reference: REF_AD });
  await pause(2000);
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  cue("Bốn mươi lăm triệu vượt hạn mức hai mươi triệu. NIVO dừng lại, và gửi cho chủ spa một thẻ Vượt quyền, kèm đề xuất.");
  await reloadUntil("the over-authority card", async () => (await openCard(page, REF_AD).count()) > 0, 60_000).catch(() => {});
  await spot(openCard(page, REF_AD), 5000).catch(() => pause(3000));
  cue("Chủ spa đồng ý. Có thể bấm nút, hoặc gõ chữ đồng ý trong khung chat.");
  await pause(2000);
  await click(openCard(page, REF_AD).getByRole("button", { name: /Đồng ý để NIVO tiếp tục/ }).first()).catch(() => {});
  cue("NIVO tiếp tục đúng công việc cũ: Sales xác nhận đơn, rồi tự chuyển sang Kế toán xuất hóa đơn bốn mươi lăm triệu. Thẻ ghi rõ ai đã quyết định, lúc nào.");
  await reloadUntil("the decided card", async () => (await doneCard(page, REF_AD).count()) > 0, 60_000).catch(() => {});
  await spot(doneCard(page, REF_AD).first(), 5000).catch(() => pause(3000));
});

await scene("07", "chuyen-khoan", async (h) => {
  const { page, click, spot, pause, reloadUntil } = h;
  await page.goto(base + "/inbox", { waitUntil: "networkidle" });
  cue("Một tình huống khác: ngân hàng báo có năm triệu đồng chuyển vào, nhưng nội dung chỉ ghi chuyển tiền, không rõ của ai. Đây cũng là mô phỏng.");
  await simulate(h, { channel: "Ngân hàng", kind: "Thanh toán", name: "Người chuyển khoản", amount: 5_000_000, reference: `CK chuyen tien ${rnd}` });
  await pause(2000);
  await page.goto(base + "/chat", { waitUntil: "networkidle" });
  cue("NIVO không đoán bừa. Nó hỏi chủ spa: khoản tiền này là của hóa đơn nào, và gợi ý các hóa đơn khớp số tiền.");
  const card = () => officeLog(page).locator('[data-testid="exception-card"]').filter({ hasText: /Chưa rõ kết quả/ }).filter({ has: page.getByRole("button", { name: /Đồng ý để NIVO tiếp tục/ }) }).last();
  await reloadUntil("the unclear payment card", async () => (await card().count()) > 0, 60_000).catch(() => {});
  await spot(card(), 4500).catch(() => pause(3000));
  cue("Chủ spa nhận ra đây là tiền của anh Minh, chọn đúng hóa đơn của anh Minh, rồi bấm đồng ý.");
  const radios = card().getByRole("radio");
  const minh = radios.filter({ hasText: /Minh/ });
  await click((await minh.count()) ? minh.first() : radios.first()).catch(() => {});
  await pause(1500);
  await click(card().getByRole("button", { name: /Đồng ý để NIVO tiếp tục/ }).first()).catch(() => {});
  cue("NIVO đối soát: hóa đơn của anh Minh chuyển sang Đã thanh toán, và Sales AI tự gửi lời cảm ơn anh Minh.");
  await pause(6000);
});

await scene("08", "ket-qua", async ({ page, spot, pause }) => {
  await page.goto(base + "/dashboard", { waitUntil: "networkidle" });
  // Never narrate over a loading skeleton: wait for the real blocks.
  await page.getByRole("heading", { name: /Kết quả thật/ }).first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
  await pause(1200);
  cue("Bước năm: kết quả quản trị. Trang Tổng quan cho chủ spa thấy NIVO đã tự làm bao nhiêu việc, và hỏi bao nhiêu việc.");
  await pause(2000);
  await spot(page.getByText(/Tổng quan 7 ngày qua/).first(), 4000).catch(() => pause(3000));
  cue("Kết quả thật: đơn đã xác nhận, hóa đơn đã xuất, tiền đã thu. Mỗi con số đều ghi rõ nguồn, có bao nhiêu dữ liệu là mô phỏng.");
  await spot(page.getByRole("heading", { name: /Kết quả thật/ }).first(), 4000).catch(() => pause(3000));
  await page.goto(base + "/decisions", { waitUntil: "networkidle" });
  await page.getByText("Công ty Ánh Dương").first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
  await pause(800);
  cue("Trang Lịch sử quyết định ghi lại từng việc: ai quyết, khi nào, kết quả ra sao. Việc NIVO tự làm theo chính sách cũng được ghi lại.");
  await pause(2500);
  await spot(page.getByText("Công ty Ánh Dương").first(), 4500).catch(() => pause(3000));
  cue("Tóm lại: chủ spa giao quyền, AI thực hiện, NIVO kiểm tra kết quả, và chỉ hỏi khi thật sự cần.");
  await pause(4000);
});

await browser.close();
writeFileSync(join(outDir, "story.json"), JSON.stringify(story, null, 2));
console.log(`story recorded → ${outDir} (${story.scenes.filter((s) => s.error).length} scene errors)`);
