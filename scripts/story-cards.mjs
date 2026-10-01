#!/usr/bin/env node
// Cards and captions for the story video: intro, cast, flow, step cards, outro, the Telegram phone label, and one caption
// PNG per narration cue in story.json. Usage: node scripts/story-cards.mjs <outDir> <story.json>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";

const [outDir, storyPath] = process.argv.slice(2);
if (!outDir || !storyPath) { console.error("usage: node scripts/story-cards.mjs <outDir> <story.json>"); process.exit(1); }
mkdirSync(outDir, { recursive: true });
const story = JSON.parse(readFileSync(storyPath, "utf8"));
const dataUri = (file) => `data:image/${extname(file).slice(1).replace("jpg", "jpeg")};base64,${readFileSync(file).toString("base64")}`;
const pub = (p) => dataUri(resolve("public", p));
const flowImg = dataUri(resolve("design-refs/nivo-operating-flow.webp"));

const FONT = `<meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">`;
const HEAD = `${FONT}<style>
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;font-family:"Open Sans",sans-serif;color:#0F172A;background:#F8FAFC;overflow:hidden}
.wrap{position:absolute;inset:0;display:flex;align-items:center;padding:0 140px;gap:80px}
.eyebrow{font-size:30px;font-weight:700;letter-spacing:.14em;color:#E11D48;text-transform:uppercase}
h1{font-size:92px;line-height:1.08;font-weight:800;margin:22px 0 26px}
p{font-size:38px;line-height:1.45;color:#475569}
.motto{display:inline-flex;gap:14px;align-items:center;white-space:nowrap;margin-top:40px;padding:20px 30px;border:2px solid #E2E8F0;border-radius:18px;background:#fff;font-size:28px;font-weight:700}
.motto span{color:#E11D48}
.mascot{max-height:760px;max-width:680px;width:auto;height:auto;flex:none;object-fit:contain}
.col{flex:1;min-width:880px;max-width:1040px}
.stepnum{font-size:220px;font-weight:800;color:#FFE4E6;line-height:1;position:absolute;right:120px;top:40px}
.band{position:absolute;left:0;right:0;bottom:0;height:14px;background:linear-gradient(90deg,#E11D48,#FB7185)}
.logo{height:72px}
.pill{display:inline-block;margin-top:34px;padding:14px 28px;border-radius:999px;background:#E11D48;color:#fff;font-size:34px;font-weight:700}
.cast{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:34px}
.who{background:#fff;border:2px solid #E2E8F0;border-radius:18px;padding:22px 26px;display:flex;gap:20px;align-items:center}
.av{width:72px;height:72px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:28px}
.who b{font-size:32px;display:block}.who span{font-size:24px;color:#475569}
.tag{display:inline-block;margin-top:6px;padding:3px 12px;border-radius:999px;font-size:20px;font-weight:700}
.real{background:#DCFCE7;color:#166534}.sim{background:#FFE4E6;color:#7F1D1D}
@keyframes up{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
@keyframes pop{from{opacity:0;transform:scale(.85) translateY(30px)}to{opacity:1;transform:none}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.col>*,.eyebrow,h1,p,.motto,.pill,.who{opacity:0;animation:up .8s cubic-bezier(.2,.8,.2,1) forwards}
.eyebrow{animation-delay:.15s}h1{animation-delay:.35s}p{animation-delay:.6s}.motto{animation-delay:.9s}.pill{animation-delay:1.2s}
.col>img.logo{animation-delay:0s}
.mascot{opacity:0;animation:pop 1s cubic-bezier(.2,.8,.2,1) .4s forwards}
.who:nth-child(1){animation-delay:.5s}.who:nth-child(2){animation-delay:.7s}.who:nth-child(3){animation-delay:.9s}.who:nth-child(4){animation-delay:1.1s}.who:nth-child(5){animation-delay:1.3s}.who:nth-child(6){animation-delay:1.5s}
.band{transform-origin:left;animation:grow 1.2s ease-out forwards}
.stepnum{opacity:0;animation:pop 1s ease-out .2s forwards}
.flowimg{opacity:0;animation:pop 1.1s cubic-bezier(.2,.8,.2,1) .5s forwards}
</style>`;
const MOTTO = `<div class="motto">Giao quyền <span>→</span> AI thực hiện <span>→</span> Kiểm tra kết quả <span>→</span> Chỉ hỏi khi cần</div>`;
const MASCOT = { step1: "images/promo/mascot-checklist.png", step2: "images/promo/mascot-chat.png", step3: "images/promo/mascot-point.png", step4: "images/promo/mascot-night.png", step5: "images/promo/mascot-celebrate.png" };
const STEPS = {
  step1: ["Bước 1", "Chủ doanh nghiệp giao quyền", "Nhắn cho NIVO bằng lời thường: việc nào AI tự làm, việc nào phải hỏi trước."],
  step2: ["Bước 2", "NIVO nhận đầu vào", "Khách nhắn từ Telegram (kênh thật), Zalo, Facebook, ngân hàng (mô phỏng) — tất cả vào một chỗ."],
  step3: ["Bước 3", "Các bộ phận AI tự vận hành", "Chatbot AI → Sales AI → Kế toán AI tự làm việc thường lệ, trong phạm vi được giao."],
  step4: ["Bước 4", "Tự xử lý hoặc xin quyết định", "Vượt quyền, thiếu dữ kiện, chưa rõ kết quả → NIVO hỏi, bạn quyết, NIVO làm tiếp."],
  step5: ["Bước 5", "Kết quả quản trị", "Kết quả thật · Việc đang chờ · Ngoại lệ · Lịch sử quyết định."],
};
const person = (initials, color, name, line, real) => `<div class="who"><div class="av" style="background:${color}">${initials}</div><div><b>${name}</b><span>${line}</span><br><span class="tag ${real ? "real" : "sim"}">${real ? "Kênh thật" : "Mô phỏng"}</span></div></div>`;

const CARDS = {
  intro: `${HEAD}<div class="wrap"><div class="col"><img class="logo" src="${pub("brand/nivo-os.png")}"><h1>Hệ điều hành vận hành cho doanh nghiệp nhỏ</h1><p>AI làm việc thường lệ. Bạn chỉ quyết định khi cần.</p>${MOTTO}</div><img class="mascot" src="${pub("images/nivo-unicorn.png")}"></div><div class="band"></div>`,
  cast: `${HEAD}<div class="wrap" style="display:block;padding-top:90px"><div class="eyebrow">Ví dụ minh họa</div><h1 style="font-size:72px">Một ngày ở Spa Hoa Mai</h1>
    <div class="cast">
      ${person("AN", "#0F172A", "Chủ spa", "Giao quyền và chỉ quyết định khi NIVO hỏi", true)}
      ${person("CL", "#0F766E", "Chị Lan", "Nhắn qua Telegram, hỏi liệu trình chăm sóc da", true)}
      ${person("AM", "#1D4ED8", "Anh Minh", "Đặt gói 5 triệu qua Zalo", false)}
      ${person("ÁD", "#B45309", "Công ty Ánh Dương", "Đặt đơn 45 triệu qua Facebook", false)}
      ${person("₫", "#7C3AED", "Ngân hàng", "Báo có 5 triệu, nội dung không rõ", false)}
      ${person("AI", "#E11D48", "Nhân viên AI", "Chatbot · Sales · Kế toán, trong phạm vi được giao", true)}
    </div></div><div class="band"></div>`,
  flow: `${HEAD}<div class="wrap" style="justify-content:center;gap:70px"><div style="width:620px"><div class="eyebrow">Dòng chảy vận hành</div><h1 style="font-size:72px">5 bước, làm ngay trong khung chat</h1><p>Mỗi bước tiếp theo là cảnh quay thật trên nivo.vn.</p></div><img class="flowimg" src="${flowImg}" style="height:1000px;border-radius:16px;border:2px solid #E2E8F0"></div><div class="band"></div>`,
  outro: `${HEAD}<div class="wrap"><div class="col"><img class="logo" src="${pub("brand/nivo-os.png")}"><h1>Giao quyền.<br>Chỉ hỏi khi cần.</h1>${MOTTO}<br><div class="pill">Dùng thử tại nivo.vn</div></div><img class="mascot" src="${pub("images/promo/mascot-offer.png")}"></div><div class="band"></div>`,
};
// V1.1 cards (founder script): 01 problem, 02 demo scope, 15 meaning for the leader, 16 close + CTA.
const note = (t) => `<div class="who" style="padding:26px 30px"><div><b style="font-size:34px">${t}</b></div></div>`;
CARDS.problem = `${HEAD}<div class="wrap"><div class="col"><div class="eyebrow">Spa Hoa Mai · một buổi sáng</div><h1 style="font-size:80px">Ai đang phải nhớ và nối mọi việc?</h1>
  <div class="cast" style="grid-template-columns:1fr;gap:18px;max-width:820px">${note("Một khách vừa hỏi dịch vụ")}${note("Một đơn cần xác nhận")}${note("Một khoản tiền chưa rõ của ai")}</div></div><img class="mascot" src="${pub("images/promo/mascot-night.png")}"></div><div class="band"></div>`;
CARDS.scope = `${HEAD}<div class="wrap"><div class="col"><div class="eyebrow">Tình huống minh họa · dữ liệu mẫu</div><h1 style="font-size:80px">Theo một hồ sơ: anh Minh</h1><p>Gói gội đầu dưỡng sinh 10 buổi · 5.000.000 đ</p>
  <div class="cast" style="grid-template-columns:1fr 1fr"><div class="who"><div><b>Zalo</b><span class="tag sim">Mô phỏng</span></div></div><div class="who"><div><b>Báo có ngân hàng</b><span class="tag sim">Mô phỏng</span></div></div></div></div><img class="mascot" src="${pub("images/promo/mascot-checklist.png")}"></div><div class="band"></div>`;
CARDS.leader = `${HEAD}<div class="wrap"><div class="col"><div class="eyebrow">Ý nghĩa với nhà lãnh đạo</div><h1 style="font-size:76px">Nhà lãnh đạo dẫn dắt</h1><p>AI và workflow vận hành trong quyền.<br>Giá trị cần đo qua vận hành thật.</p></div><img class="mascot" src="${pub("images/promo/mascot-celebrate.png")}"></div><div class="band"></div>`;
CARDS.outro16 = `${HEAD}<div class="wrap"><div class="col"><img class="logo" src="${pub("brand/nivo-os.png")}"><h1 style="font-size:70px">Giao việc rõ.<br>Vận hành trong quyền.<br>Chỉ hỏi bạn khi cần.</h1><div class="pill">Đăng ký xem demo · nivo.vn</div></div><img class="mascot" src="${pub("images/promo/mascot-point.png")}"></div><div class="band"></div>`;
for (const [k, [eyebrow, title, body]] of Object.entries(STEPS)) {
  CARDS[k] = `${HEAD}<div class="stepnum">${eyebrow.split(" ")[1]}</div><div class="wrap"><div class="col"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${body}</p></div><img class="mascot" src="${pub(MASCOT[k])}"></div><div class="band"></div>`;
}

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
// Caption = the narration line; an optional on-screen chip (V1.1 "Chữ trên màn hình") sits right above it.
const caption = (text, chip) => `${FONT}<style>*{margin:0;box-sizing:border-box}html,body{background:transparent}body{width:1920px;height:230px;font-family:"Open Sans",sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:10px;padding-bottom:22px}
.k{padding:7px 18px;border-radius:999px;background:#E11D48;color:#fff;font-size:24px;font-weight:700;white-space:nowrap}
.c{max-width:1700px;padding:14px 32px;border-radius:16px;background:rgba(15,23,42,.9);color:#fff;font-size:32px;font-weight:600;line-height:1.36;text-align:center}</style>${chip ? `<div class="k">${escape(chip)}</div>` : ""}<div class="c">${escape(text)}</div>`;
const CORNER = `${FONT}<style>*{margin:0}html,body{background:transparent}body{width:620px;height:44px;font-family:"Open Sans",sans-serif;display:flex;align-items:center;justify-content:flex-end}
.b{padding:6px 16px;border-radius:999px;background:rgba(15,23,42,.82);color:#fff;font-size:18px;font-weight:700;white-space:nowrap}</style><div class="b">Tình huống minh họa · NIVO OS</div>`;
const LABEL = `${FONT}<style>*{margin:0}html,body{background:transparent}body{width:640px;height:70px;font-family:"Open Sans",sans-serif;display:flex;align-items:center;justify-content:center}
.l{padding:10px 22px;border-radius:999px;background:#0F766E;color:#fff;font-size:22px;font-weight:700;white-space:nowrap}</style><div class="l">Điện thoại anh Minh · Telegram</div>`;

const browser = await chromium.launch();
// Animated title cards: record each card's entrance animation (4s) as video; the edit holds the last frame as long as needed.
for (const [name, html] of Object.entries(CARDS)) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: join(outDir, "_rec"), size: { width: 1920, height: 1080 } } });
  const p = await ctx.newPage();
  await p.setContent(html.replace(/animation:/g, "animation-play-state:paused;animation:"), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.querySelectorAll("*").forEach((el) => { el.style.animationPlayState = "running"; }));
  await p.waitForTimeout(4000);
  await p.screenshot({ path: join(outDir, `card-${name}.png`) });
  const v = p.video();
  await ctx.close();
  const { renameSync } = await import("node:fs");
  renameSync(await v.path(), join(outDir, `card-${name}.webm`));
}
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
// Stage: brand gradient background, a browser window frame (rounded, shadow, title bar with nivo.vn) with a transparent
// content hole, and a phone frame. The edit layers: background → video → frame.
const STAGE = (inner) => `${FONT}<style>*{margin:0;box-sizing:border-box}html,body{background:transparent;width:1920px;height:1080px;overflow:hidden}${inner}</style>`;
await page.setContent(`${FONT}<style>*{margin:0}body{width:1920px;height:1080px;background:radial-gradient(1200px 700px at 15% 10%,#FFE4E6 0%,rgba(255,228,230,0) 60%),radial-gradient(1000px 700px at 90% 100%,#E0E7FF 0%,rgba(224,231,255,0) 60%),linear-gradient(135deg,#FFF1F2,#F8FAFC 55%,#EEF2FF)}</style>`, { waitUntil: "networkidle" });
await page.screenshot({ path: join(outDir, "stage-bg.png") });
// Window = white rounded card with shadow and a title bar; the video sits in its content rect (rounded by an alpha mask).
const windowFrame = (x, y, w, h) => STAGE(`
.win{position:absolute;left:${x}px;top:${y - 44}px;width:${w}px;height:${h + 44}px;border-radius:18px;background:#fff;box-shadow:0 30px 80px rgba(15,23,42,.25),0 0 0 1px rgba(15,23,42,.08)}
.bar{position:absolute;left:${x}px;top:${y - 44}px;width:${w}px;height:44px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;padding:0 18px;gap:9px;font-family:"Open Sans"}
.dot{width:13px;height:13px;border-radius:50%}.url{margin-left:18px;width:420px;height:28px;border-radius:8px;background:#F1F5F9;color:#475569;font-size:15px;display:flex;align-items:center;padding:0 14px}
`) + `<div class="win"></div><div class="bar"><span class="dot" style="background:#FF5F57"></span><span class="dot" style="background:#FEBC2E"></span><span class="dot" style="background:#28C840"></span><div class="url">🔒 nivo.vn</div></div>`;
const mask = (w, h, r, top) => `<style>*{margin:0}body{width:${w}px;height:${h}px;background:#000}</style><div style="width:${w}px;height:${h}px;background:#fff;border-radius:${top ? `${r}px ${r}px` : "0 0"} ${r}px ${r}px"></div>`;
const LAYOUT = { single: [200, 84, 1520, 950], split: [40, 120, 1320, 825] };
for (const [k, [x, y, w, h]] of Object.entries(LAYOUT)) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setContent(windowFrame(x, y, w, h), { waitUntil: "networkidle" });
  await page.screenshot({ path: join(outDir, `frame-${k}.png`), omitBackground: true });
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(mask(w, h, 18, false));
  await page.screenshot({ path: join(outDir, `mask-${k}.png`) });
}
writeFileSync(join(outDir, "layout.json"), JSON.stringify({ ...LAYOUT, phone: [1444, 102, 392, 852] }));
await page.setViewportSize({ width: 392, height: 852 });
await page.setContent(mask(392, 852, 40, true));
await page.screenshot({ path: join(outDir, "mask-phone.png") });
await page.setViewportSize({ width: 1920, height: 1080 });
await page.setContent(STAGE(`.ph{position:absolute;left:1430px;top:88px;width:420px;height:880px;border-radius:54px;background:#0F172A;box-shadow:0 30px 80px rgba(15,23,42,.35)}
.notch{position:absolute;left:1580px;top:94px;width:120px;height:20px;border-radius:0 0 14px 14px;background:#0F172A;z-index:2}`) + `<div class="ph"></div>`, { waitUntil: "networkidle" });
await page.screenshot({ path: join(outDir, "frame-phone.png"), omitBackground: true });
await page.setViewportSize({ width: 1920, height: 1080 });
await page.setViewportSize({ width: 640, height: 70 });
await page.setContent(LABEL, { waitUntil: "networkidle" });
await page.screenshot({ path: join(outDir, "label-telegram.png"), omitBackground: true });
await page.setViewportSize({ width: 620, height: 44 });
await page.setContent(CORNER, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(outDir, "corner.png"), omitBackground: true });
await page.setViewportSize({ width: 1920, height: 230 });
const index = [];
for (const s of story.scenes) {
  for (const [i, c] of s.cues.entries()) {
    const file = `cap-${s.nn}-${i}.png`;
    await page.setContent(caption(c.text, c.chip), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(outDir, file), omitBackground: true });
    index.push(file);
  }
}
await browser.close();
writeFileSync(join(outDir, "captions.json"), JSON.stringify(index));
console.log(`story cards + ${index.length} captions → ${outDir}`);
