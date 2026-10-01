#!/usr/bin/env node
// Animated pitch slides for the NIVO OS product video (1920x1080). Each slide is recorded as a short webm of its entrance
// animation (the edit holds the last frame for the narration) plus a PNG of the final frame.
// Usage: node scripts/pitch-slides.mjs <outDir>
import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";

const outDir = process.argv[2];
if (!outDir) { console.error("usage: node scripts/pitch-slides.mjs <outDir>"); process.exit(1); }
mkdirSync(outDir, { recursive: true });
const dataUri = (file) => `data:image/${extname(file).slice(1).replace("jpg", "jpeg")};base64,${readFileSync(file).toString("base64")}`;
const pub = (p) => dataUri(resolve("public", p));

const HEAD = `<meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;font-family:"Open Sans",sans-serif;color:#0F172A;background:#F8FAFC;overflow:hidden;position:relative}
.dark{background:#0F172A;color:#fff}
.pad{position:absolute;inset:0;padding:110px 140px}
.eyebrow{font-size:28px;font-weight:700;letter-spacing:.16em;color:#E11D48;text-transform:uppercase}
h1{font-size:84px;line-height:1.1;font-weight:800;margin:22px 0}
h2{font-size:60px;line-height:1.15;font-weight:800;margin:18px 0}
p,.p{font-size:36px;line-height:1.5;color:#475569}
.dark p{color:#CBD5E1}
.src{position:absolute;left:140px;bottom:50px;font-size:20px;color:#94A3B8}
.band{position:absolute;left:0;right:0;bottom:0;height:12px;background:linear-gradient(90deg,#E11D48,#FB7185);transform-origin:left;animation:grow 1.2s ease-out forwards}
.card{background:#fff;border:2px solid #E2E8F0;border-radius:22px;padding:30px 34px}
.dark .card{background:#1E293B;border-color:#334155}
.red{color:#E11D48}
.chip{display:inline-block;padding:8px 18px;border-radius:999px;background:#FFE4E6;color:#9F1239;font-size:24px;font-weight:700}
.row{display:flex;gap:28px}
.a{opacity:0;animation:up .8s cubic-bezier(.2,.8,.2,1) forwards}
.d1{animation-delay:.15s}.d2{animation-delay:.45s}.d3{animation-delay:.75s}.d4{animation-delay:1.05s}.d5{animation-delay:1.35s}.d6{animation-delay:1.65s}.d7{animation-delay:1.95s}.d8{animation-delay:2.25s}.d9{animation-delay:2.55s}
.pop{opacity:0;animation:pop .9s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes up{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
@keyframes pop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:none}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes draw{to{stroke-dashoffset:0}}
.mascot{position:absolute;right:120px;bottom:60px;height:560px}
</style>`;
const slide = (body, cls = "") => `${HEAD}<body class="${cls}">${body}<div class="band"></div></body>`;

const S = {};

S.hook = slide(`<div class="pad" style="display:flex;flex-direction:column;justify-content:center">
  <div class="eyebrow a d1">NIVO OS · Hệ điều hành mới của doanh nghiệp</div>
  <h1 class="a d2" style="font-size:96px;max-width:1500px">Tuần này, việc nào<br>vẫn chỉ được bảo đảm<br>vì chính <span class="red">anh/chị nhớ?</span></h1></div>
  <img class="mascot pop d4" src="${pub("images/promo/mascot-night.png")}">`, "dark");

S.story = slide(`<div class="pad"><div class="eyebrow a d1">Một lead, ba ngày</div>
  <h2 class="a d2">AI giúp được một tác vụ.<br>Doanh nghiệp vẫn chưa bảo đảm được một trách nhiệm.</h2>
  <div class="row" style="margin-top:60px">
    ${[["9:00", "Khách hỏi qua website"], ["9:05", "AI soạn thư phản hồi — rất nhanh"], ["?", "Chưa ai phụ trách · Zalo ở một nơi · người báo giá đang họp"], ["Ngày 3", "“Khách này đã được theo tiếp chưa?”"]]
      .map(([t, s], i) => `<div class="card a d${i + 3}" style="flex:1"><div style="font-size:54px;font-weight:800;color:${i === 3 ? "#E11D48" : "#0F172A"}">${t}</div><div class="p" style="font-size:30px;margin-top:10px">${s}</div></div>`).join("")}
  </div></div>`);

S.brain = slide(`<div class="pad"><div class="eyebrow a d1">Hệ điều hành cũ</div>
  <h1 class="a d2">Hệ điều hành thật<br>đang nằm trong <span class="red">đầu người lãnh đạo</span></h1>
  <div class="row" style="margin-top:50px;flex-wrap:wrap;max-width:1200px">
    ${["Khách nào đang ở đâu?", "Ai làm tiếp?", "Khoản tiền nào chưa về?", "Việc nào đang chờ tôi quyết?"].map((q, i) => `<div class="chip a d${i + 3}" style="font-size:32px;padding:14px 26px">${q}</div>`).join("")}
  </div><p class="a d8" style="margin-top:50px">Doanh nghiệp chỉ lớn được bằng sự chú ý của một người.</p></div>
  <img class="mascot pop d5" style="height:520px" src="${pub("images/promo/mascot-checklist.png")}">`);

S.stats = slide(`<div class="pad"><div class="eyebrow a d1">Nghịch lý AI</div>
  <h2 class="a d2">AI có mặt khắp nơi. Cách vận hành thì vẫn cũ.</h2>
  <div class="row" style="margin-top:70px">
    <div class="card pop d3" style="flex:1;text-align:center;padding:60px"><div style="font-size:170px;font-weight:800;color:#0F172A">88%</div><div class="p">tổ chức đã dùng AI ở ít nhất một chức năng (2025)</div></div>
    <div class="card pop d5" style="flex:1;text-align:center;padding:60px;border-color:#E11D48"><div style="font-size:120px;font-weight:800;color:#E11D48;line-height:1.4">1 chữ số</div><div class="p">tỷ lệ triển khai AI Agent ở quy mô, ở gần như mọi chức năng</div></div>
  </div></div><div class="src">Nguồn: Stanford HAI AI Index 2026, Ch.4 · số liệu khảo sát quốc tế</div>`);

S.task = slide(`<div class="pad"><div class="eyebrow a d1">Vì sao?</div>
  <h2 class="a d2">AI mới làm <u>tác vụ</u>. Chưa nhận <span class="red">trách nhiệm</span>.</h2>
  <div class="row" style="margin-top:60px">
    <div class="card a d3" style="flex:1"><div class="chip" style="background:#E2E8F0;color:#334155">Tác vụ</div><h2 style="font-size:48px">Việc gì cần làm?</h2><p>Soạn một thư · tóm tắt cuộc họp · phân loại một lead</p></div>
    <div class="card a d5" style="flex:1.3;border-color:#E11D48"><div class="chip">Trách nhiệm</div>
      <p style="margin-top:22px;color:#0F172A;font-size:38px;line-height:1.7">① Điều gì phải được bảo đảm xảy ra?<br>② Ai chịu trách nhiệm cuối cùng?<br>③ Hệ thống được phép làm đến đâu?</p></div>
  </div></div>`);

S.thesis = slide(`<div class="pad" style="display:flex;flex-direction:column;justify-content:center">
  <img class="a d1" style="height:96px;width:auto;align-self:flex-start" src="${pub("brand/nivo-os.png")}">
  <h1 class="a d2" style="max-width:1300px">Một hệ vận hành<br>theo <span class="red">trách nhiệm</span></h1>
  <p class="a d3" style="max-width:980px">Con người, nhân viên AI và hệ thống cùng làm việc trong giới hạn rõ ràng — và mọi kết quả đều có bằng chứng.</p>
  <div class="row a d4" style="margin-top:40px">${["Human Leads.", "AI Operates.", "System Learns."].map((t) => `<div class="chip" style="font-size:34px;padding:12px 28px">${t}</div>`).join("")}</div></div>
  <img class="mascot pop d5" src="${pub("images/nivo-unicorn.png")}">`);

{
  const nodes = ["Ý định + giới hạn", "Kết quả kiểm chứng được", "Trách nhiệm", "Người + AI thực hiện", "Bằng chứng", "Verified Outcome", "Học hỏi", "Mở rộng quyền"];
  const cx = 960, cy = 600, R = 330;
  const pts = nodes.map((_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
  const boxes = nodes.map((n, i) => `<div class="card pop d${i + 1}" style="position:absolute;left:${pts[i][0] - 160}px;top:${pts[i][1] - 48}px;width:320px;height:96px;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px 18px;font-size:27px;font-weight:700;${i === 2 || i === 5 ? "border-color:#E11D48;color:#E11D48" : ""}">${n}</div>`).join("");
  S.loop = slide(`<div class="pad" style="padding-top:60px"><div class="eyebrow a d1">Vòng vận hành NIVO OS</div></div>
    <svg width="1920" height="1080" style="position:absolute;inset:0"><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#FDA4AF" stroke-width="6" stroke-dasharray="2100" stroke-dashoffset="2100" style="animation:draw 2.6s ease-out .3s forwards"/></svg>
    ${boxes}
    <div style="position:absolute;left:${cx - 200}px;top:${cy - 60}px;width:400px;text-align:center" class="a d9"><div style="font-size:30px;font-weight:800">Chính sách · Quyền · Kiểm toán</div><div style="font-size:24px;color:#64748B;margin-top:8px">bao quanh toàn bộ vòng</div></div>`);
}

S.bridge = slide(`<div class="pad" style="display:flex;flex-direction:column;justify-content:center">
  <div class="eyebrow a d1">Minh họa · quay thật trên nivo.vn</div>
  <h1 class="a d2" style="font-size:100px">Một ngày ở<br><span class="red">Spa Hoa Mai</span></h1>
  <p class="a d3">Chủ spa · chị Hà tư vấn viên · nhân viên AI · anh Minh trên Telegram</p></div>
  <img class="mascot pop d4" src="${pub("images/promo/mascot-chat.png")}">`, "dark");

S.recap = slide(`<div class="pad"><div class="eyebrow a d1">Điều vừa xảy ra</div>
  <h2 class="a d2">Mỗi bước đều có người chịu trách nhiệm và bằng chứng</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:50px">
    ${[["Giao quyền một lần", "Chủ spa đặt mục tiêu và giới hạn"], ["AI làm trong phạm vi", "Tư vấn · chốt đơn · khớp tiền"], ["Vượt quyền → đúng người", "Ưu đãi do chị Hà quyết"], ["Mọi bước có bằng chứng", "Ai làm · ai quyết · căn cứ gì"]]
      .map(([t, s], i) => `<div class="card a d${i + 3}"><div style="font-size:40px;font-weight:800">${t}</div><div class="p" style="font-size:30px;margin-top:8px">${s}</div></div>`).join("")}
  </div></div>`);

S.ladder = slide(`<div class="pad"><div class="eyebrow a d1">Thang quyền</div>
  <h2 class="a d2">Quyền của AI được <span class="red">kiếm</span>, không phải được mua</h2>
  <div style="position:relative;height:560px;margin-top:40px">
    ${[["A0", "Quan sát"], ["A1", "Đề xuất"], ["A2", "Chuẩn bị"], ["A3", "Làm sau khi duyệt"], ["A4", "Làm trong chính sách"], ["A5", "Duy trì trách nhiệm"]]
      .map(([k, t], i) => `<div class="card a d${i + 3}" style="position:absolute;left:${i * 272}px;bottom:${i * 78}px;width:250px;padding:22px;${i >= 4 ? "border-color:#E11D48" : ""}"><div style="font-size:44px;font-weight:800;color:${i >= 4 ? "#E11D48" : "#0F172A"}">${k}</div><div style="font-size:26px;font-weight:600;color:#475569">${t}</div></div>`).join("")}
  </div><p class="a d9" style="position:absolute;left:140px;bottom:60px">Quyền tăng theo bằng chứng — và có thể thu hồi bất cứ lúc nào.</p></div>`);

S.evidence = slide(`<div class="pad"><div class="eyebrow a d1">Kỷ luật bằng chứng</div>
  <h2 class="a d2">Không tuyên bố vượt quá bằng chứng</h2>
  <div style="margin-top:50px;display:flex;flex-direction:column;gap:22px">
    ${[["Thư đã gửi", "Khách đã chốt"], ["Đơn đã xác nhận", "Tiền đã về"], ["AI làm nhanh hơn", "Doanh nghiệp tốt hơn"]]
      .map(([a, b], i) => `<div class="a d${i + 3}" style="display:flex;align-items:center;gap:30px;font-size:44px;font-weight:700"><span class="card" style="padding:18px 30px">${a}</span><span class="red" style="font-size:60px">≠</span><span class="card" style="padding:18px 30px">${b}</span></div>`).join("")}
  </div><div class="chip a d7" style="margin-top:50px;font-size:34px;padding:14px 28px">Quản lý trách nhiệm — không giám sát con người</div></div>`);

S.days90 = slide(`<div class="pad"><div class="eyebrow a d1">Bắt đầu</div>
  <h2 class="a d2">Một trách nhiệm. <span class="red">90 ngày.</span> Bốn cổng quyết định.</h2>
  <div style="position:relative;margin-top:110px;height:300px">
    <div style="position:absolute;left:0;right:0;top:60px;height:8px;background:#E2E8F0;border-radius:4px"></div>
    <div style="position:absolute;left:0;top:60px;height:8px;background:#E11D48;border-radius:4px;width:100%;transform-origin:left;animation:grow 2.4s ease-out .4s both"></div>
    ${[["Ngày 30", "Đã thiết kế"], ["Ngày 60", "Đã xây"], ["Ngày 60", "Đã áp dụng"], ["Ngày 90", "Có bằng chứng"]]
      .map(([d, g], i) => `<div class="pop d${i + 3}" style="position:absolute;left:${[20, 36, 58, 86][i]}%;top:0;transform:translateX(-50%);text-align:center;width:300px"><div style="width:44px;height:44px;border-radius:50%;background:#E11D48;margin:40px auto 18px;border:8px solid #FFE4E6"></div><div style="font-size:26px;color:#64748B;font-weight:700">${d}</div><div style="font-size:36px;font-weight:800">${g}</div></div>`).join("")}
  </div>
  <div class="row a d8" style="margin-top:10px">${["Mở rộng", "Điều chỉnh", "Dừng"].map((t) => `<div class="chip" style="font-size:32px;padding:12px 28px">${t}</div>`).join("")}</div></div>`);

S.test = slide(`<div class="pad" style="display:flex;flex-direction:column;justify-content:center;text-align:center;align-items:center">
  <div class="eyebrow a d1">Phép thử</div>
  <h1 class="a d2" style="font-size:88px;max-width:1500px">Nếu anh/chị vắng mặt <span class="red">hai tuần</span>,<br>trách nhiệm nào vẫn được bảo đảm?</h1></div>`, "dark");

S.outro = slide(`<div class="pad" style="display:flex;flex-direction:column;justify-content:center">
  <img class="a d1" style="height:110px;width:auto;align-self:flex-start" src="${pub("brand/nivo-os.png")}">
  <h1 class="a d2" style="font-size:92px">Human Leads.<br>AI Operates.<br><span class="red">System Learns.</span></h1>
  <div class="a d4" style="margin-top:30px"><span style="display:inline-block;padding:20px 40px;border-radius:999px;background:#E11D48;color:#fff;font-size:40px;font-weight:800">Đặt lịch chẩn đoán · nivo.vn</span></div>
  <p class="a d5" style="margin-top:22px">Cùng tìm trách nhiệm đầu tiên đáng giao.</p></div>
  <img class="mascot pop d4" src="${pub("images/promo/mascot-point.png")}">`);

// Beat slides: one pitch point, then the demo proves it.
const beat = (n, eyebrow, title, sub, mascot) => slide(`<div class="pad" style="display:flex;flex-direction:column;justify-content:center">
  <div class="eyebrow a d1">${n} · ${eyebrow}</div>
  <h1 class="a d2" style="font-size:92px;max-width:1300px">${title}</h1>
  <p class="a d3" style="max-width:1150px">${sub}</p></div>
  <img class="mascot pop d4" src="${pub(mascot)}">`);
S.beatAI = beat("02", "AI vận hành trong quyền", "AI tự làm việc thường lệ,<br>trong <span class=\"red\">phạm vi được giao</span>", "Tư vấn như một nhân viên thật — không cần chủ doanh nghiệp trả lời.", "images/promo/mascot-chat.png");
S.beatHuman = beat("03", "Human Leads", "Vượt quyền,<br>NIVO <span class=\"red\">hỏi đúng người</span>", "Con người quyết ở điểm quan trọng — rồi NIVO làm tiếp.", "images/promo/mascot-checklist.png");
S.beatMoney = beat("04", "Đến kết quả thật", "Từ chốt đơn<br>đến <span class=\"red\">tiền về</span>", "Không ai phải nhắc — và không ai phải tự đối soát.", "images/promo/mascot-celebrate.png");

const only = process.argv[3] ? new Set(process.argv[3].split(",")) : null;
const browser = await chromium.launch();
for (const [name, html] of Object.entries(S)) {
  if (only && !only.has(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: join(outDir, "_rec"), size: { width: 1920, height: 1080 } } });
  const p = await ctx.newPage();
  await p.setContent(html.replace(/<style>/, "<style>*{animation-play-state:paused!important}"), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => { document.querySelector("style").textContent = document.querySelector("style").textContent.replace("*{animation-play-state:paused!important}", ""); });
  await p.waitForTimeout(4500);
  await p.screenshot({ path: join(outDir, `card-${name}.png`) });
  const v = p.video();
  await ctx.close();
  renameSync(await v.path(), join(outDir, `card-${name}.webm`));
  console.log(name);
}
await browser.close();
