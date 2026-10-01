#!/usr/bin/env node
// Render the intro-video title cards and caption strips as PNGs (1920x1080 cards, 1920x200 transparent captions).
// Usage: node scripts/video-cards.mjs <outDir> <script.json>
// Cards use the NIVO brand (Open Sans, crimson #E11D48, ink #0F172A, canvas #F8FAFC) and the real mascot/flow images.
import { mkdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";

const [outDir, scriptPath] = process.argv.slice(2);
if (!outDir || !scriptPath) {
  console.error("usage: node scripts/video-cards.mjs <outDir> <script.json>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const script = JSON.parse(readFileSync(scriptPath, "utf8"));
// Inline images as data URIs: a page built with setContent cannot load file:// URLs.
const dataUri = (file) => `data:image/${extname(file).slice(1).replace("jpg", "jpeg")};base64,${readFileSync(file).toString("base64")}`;
const pub = (p) => dataUri(resolve("public", p));
const flowImg = dataUri(resolve("design-refs/nivo-operating-flow.webp"));

const HEAD = `<meta charset="utf-8"><link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;font-family:"Open Sans",sans-serif;color:#0F172A;background:#F8FAFC;overflow:hidden}
.wrap{position:absolute;inset:0;display:flex;align-items:center;padding:0 140px;gap:80px}
.eyebrow{font-size:30px;font-weight:700;letter-spacing:.14em;color:#E11D48;text-transform:uppercase}
h1{font-size:96px;line-height:1.08;font-weight:800;margin:22px 0 26px}
p{font-size:38px;line-height:1.45;color:#475569}
.motto{display:inline-flex;gap:14px;align-items:center;white-space:nowrap;margin-top:40px;padding:20px 30px;border:2px solid #E2E8F0;border-radius:18px;background:#fff;font-size:28px;font-weight:700}
.motto span{color:#E11D48}
.mascot{max-height:760px;max-width:720px;width:auto;height:auto;flex:none;object-fit:contain}
.col{flex:1;min-width:880px;max-width:1000px}
.stepnum{font-size:220px;font-weight:800;color:#FFE4E6;line-height:1;position:absolute;right:120px;top:40px}
.band{position:absolute;left:0;right:0;bottom:0;height:14px;background:linear-gradient(90deg,#E11D48,#FB7185)}
.logo{height:72px}
.pill{display:inline-block;margin-top:34px;padding:14px 28px;border-radius:999px;background:#E11D48;color:#fff;font-size:34px;font-weight:700}
</style>`;

const MASCOT = { step1: "images/promo/mascot-checklist.png", step2: "images/promo/mascot-chat.png", step3: "images/promo/mascot-point.png", step4: "images/promo/mascot-night.png", step5: "images/promo/mascot-celebrate.png" };
const STEPS = {
  step1: ["Bước 1", "Chủ doanh nghiệp giao quyền", "Mục tiêu · Chính sách · Phạm vi tự động · Giới hạn — nói với NIVO ngay trong khung chat."],
  step2: ["Bước 2", "NIVO nhận đầu vào", "Khách hàng, tin nhắn, lead, đơn hàng, hóa đơn — từ mọi kênh, tự chặn trùng lặp."],
  step3: ["Bước 3", "Các bộ phận AI tự vận hành", "Chatbot AI → Sales AI → Kế toán AI, trên nền NIVO Core: kiểm tra quyền, lưu bằng chứng, audit."],
  step4: ["Bước 4", "Tự xử lý hoặc xin quyết định", "Việc thường lệ AI tự làm. Thiếu dữ kiện, vượt quyền, chưa rõ kết quả → NIVO hỏi bạn, rồi làm tiếp."],
  step5: ["Bước 5", "Kết quả quản trị", "Kết quả thật · Việc đang chờ · Ngoại lệ · Lịch sử quyết định."],
};
const MOTTO = `<div class="motto">Giao quyền <span>→</span> AI thực hiện <span>→</span> Kiểm tra kết quả <span>→</span> Chỉ hỏi khi cần</div>`;

const cardHtml = (name) => {
  if (name === "intro") return `${HEAD}<div class="wrap"><div class="col"><img class="logo" src="${pub("brand/nivo-os.png")}"><h1>Hệ điều hành vận hành<br>cho doanh nghiệp nhỏ</h1><p>AI làm việc thường lệ. Bạn chỉ quyết định khi cần.</p>${MOTTO}</div><img class="mascot" src="${pub("images/nivo-unicorn.png")}"></div><div class="band"></div>`;
  if (name === "flow") return `${HEAD}<div class="wrap" style="justify-content:center;gap:70px"><div style="width:620px"><div class="eyebrow">Dòng chảy vận hành</div><h1 style="font-size:76px">5 bước, làm ngay trong khung chat</h1><p>Mỗi bước dưới đây là cảnh quay thật trên nivo.vn.</p></div><img src="${flowImg}" style="height:1000px;border-radius:16px;border:2px solid #E2E8F0"></div><div class="band"></div>`;
  if (name === "outro") return `${HEAD}<div class="wrap"><div class="col"><img class="logo" src="${pub("brand/nivo-os.png")}"><h1>Giao quyền.<br>Chỉ hỏi khi cần.</h1>${MOTTO}<br><div class="pill">Dùng thử tại nivo.vn</div></div><img class="mascot" src="${pub("images/promo/mascot-offer.png")}"></div><div class="band"></div>`;
  const [eyebrow, title, body] = STEPS[name];
  return `${HEAD}<div class="stepnum">${eyebrow.split(" ")[1]}</div><div class="wrap"><div class="col"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${body}</p></div><img class="mascot" src="${pub(MASCOT[name])}"></div><div class="band"></div>`;
};

const captionHtml = (text, note) => `<meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@600;700&display=swap" rel="stylesheet">
<style>*{margin:0;box-sizing:border-box}html,body{background:transparent}body{width:1920px;height:200px;font-family:"Open Sans",sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:18px;gap:8px}
.c{max-width:1640px;padding:14px 30px;border-radius:14px;background:rgba(15,23,42,.86);color:#fff;font-size:34px;font-weight:600;line-height:1.35;text-align:center}
.n{padding:6px 18px;border-radius:999px;background:#FFE4E6;color:#7F1D1D;font-size:22px;font-weight:700}</style>
${note ? `<div class="n">${note}</div>` : ""}<div class="c">${text}</div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [i, seg] of script.segments.entries()) {
  if (seg.kind === "card") {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.setContent(cardHtml(seg.card), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(outDir, `card-${seg.card}.png`) });
  } else {
    // Captions: the narration split into chunks of at most ~2 lines, each its own PNG.
    const words = seg.say.split(" ");
    const chunks = [];
    let cur = [];
    for (const w of words) {
      cur.push(w);
      if (cur.join(" ").length > 110 || /[.:]$/.test(w) && cur.join(" ").length > 40) { chunks.push(cur.join(" ")); cur = []; }
    }
    if (cur.length) chunks.push(cur.join(" "));
    seg.chunks = chunks;
    await page.setViewportSize({ width: 1920, height: 200 });
    for (const [j, chunk] of chunks.entries()) {
      await page.setContent(captionHtml(chunk, seg.note), { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(outDir, `cap-${String(i).padStart(2, "0")}-${j}.png`), omitBackground: true });
    }
  }
}
await browser.close();
// Hand the caption chunking back to the builder.
import("node:fs").then(({ writeFileSync }) => writeFileSync(join(outDir, "chunks.json"), JSON.stringify(script.segments.map((s) => s.chunks ?? null))));
console.log(`cards + captions → ${outDir}`);
