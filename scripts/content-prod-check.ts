// Production check of the content module. Needs the service role (run through scripts/with-secrets.mjs):
//   node scripts/with-secrets.mjs npx --yes tsx --conditions=react-server scripts/content-prod-check.ts [--only spa|cafe] [--out results.json]
// For each of two test workspaces from different industries ("Kiểm thử · Nội dung · Spa" and "... · Quán cà phê"):
//   1. find or create the workspace, install the module, apply a context version (tone gate), add business knowledge
//   2. pillars + cadence, then "Lên kế hoạch tháng" for 2026-11 through OpenClaw (timing recorded, JSON validated)
//   3. draft 2 items with channel variants, send for approval (the gate must WAIT), approve as the stand-in owner, mark published with proof
// It uses the same library code as the workbench (src/lib/module-content-*.ts); only the session is replaced by the service role.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { installModuleCore } from "@/lib/module-install";
import { resumeWork, type EngineCtx } from "@/lib/engine";
import { draftItem, planMonth, pillarQuota } from "@/lib/module-content-ai";
import { markPublished, requestPublish } from "@/lib/module-content-publish";
import { CADENCE_PRESETS, PILLAR_PRESETS, channelRule, type ContentChannel } from "@/lib/module-content-shared";
import { ensurePillars, getItem, listItems, listPillars, saveSettings } from "@/lib/module-content-store";
import { offerDraft, todayReminder, weeklySummary } from "@/lib/module-content-tick";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("missing supabase env (run through scripts/with-secrets.mjs)");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const outFile = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
const ok = <T>(r: { data: T | null; error: { message: string } | null }, what: string): T => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data as T; };
const log = (...a: unknown[]) => console.log(...a);
const results: Record<string, unknown> = {};

type Biz = {
  id: "spa" | "cafe"; name: string; summary: string; tone: string; audience: string; claims: string; channels: string;
  knowledge: Array<{ title: string; kind: "text" | "pricing" | "faq" | "policy"; content: string }>;
  cadence: Array<{ channel: ContentChannel; posts_per_week: number; days: Array<number>; post_time: string }>;
  settings: { brand_voice: string; avoid: string; cta: string; hashtags: Array<string> };
};

const BIZ: Array<Biz> = [
  {
    id: "spa", name: "Kiểm thử · Nội dung · Spa", summary: "Spa Hoa Mai là spa chăm sóc da và thư giãn ở quận 3, TP.HCM, có 6 nhân viên.",
    tone: "Nhẹ nhàng, ấm áp, chăm sóc. Xưng em, gọi khách là chị hoặc anh. Câu ngắn, dễ hiểu.", audience: "Phụ nữ 28 đến 50 tuổi ở TP.HCM, bận rộn, muốn thư giãn và chăm sóc da.",
    claims: "Không hứa kết quả điều trị. Không nói chữa bệnh. Không so sánh với spa khác.", channels: "Facebook và Zalo OA",
    knowledge: [
      { title: "Bảng giá dịch vụ", kind: "pricing", content: "Gội đầu dưỡng sinh 60 phút: 180.000đ. Chăm sóc da cơ bản 75 phút: 350.000đ. Massage thư giãn toàn thân 90 phút: 450.000đ. Liệu trình trị mụn 10 buổi: 3.200.000đ." },
      { title: "Thông tin liên hệ và giờ mở cửa", kind: "text", content: "Địa chỉ: 25 Võ Văn Tần, quận 3, TP.HCM. Điện thoại và Zalo: 0900 000 111. Mở cửa 9:00 đến 21:00 mỗi ngày kể cả lễ. Đặt lịch trước qua Zalo." },
      { title: "Ưu đãi tháng 11", kind: "text", content: "Ưu đãi tháng 11: combo gội đầu dưỡng sinh 3 buổi giá 450.000đ cho khách mới. Tặng 1 mặt nạ dưỡng ẩm khi đặt liệu trình chăm sóc da. Áp dụng từ 1/11 đến 30/11." },
      { title: "Câu hỏi thường gặp", kind: "faq", content: "Có cần đặt lịch trước không? Nên đặt trước để chọn giờ phù hợp. Có dùng sản phẩm gì? Dùng mỹ phẩm thiên nhiên, kiểm tra da trước khi làm. Có chỗ gửi xe máy miễn phí." },
    ],
    cadence: CADENCE_PRESETS.map((c) => ({ channel: c.channel, posts_per_week: c.posts_per_week, days: [...c.days], post_time: c.time })),
    settings: { brand_voice: "Xưng em, gọi khách là chị. Không dùng từ quá y khoa.", avoid: "Không nói chữa khỏi, không nói trẻ ra bao nhiêu tuổi.", cta: "Nhắn Zalo 0900 000 111 để đặt lịch", hashtags: ["#SpaHoaMai"] },
  },
  {
    id: "cafe", name: "Kiểm thử · Nội dung · Quán cà phê", summary: "Nhà Rang là quán cà phê rang xay tại Đà Nẵng, bán cà phê tại quán và cà phê hạt đóng gói, có 4 nhân viên.",
    tone: "Trẻ trung, vui vẻ, thân thiện, hơi hài hước. Xưng mình, gọi khách là bạn.", audience: "Dân văn phòng và sinh viên 20 đến 35 tuổi ở Đà Nẵng, thích cà phê đặc sản và làm việc ở quán.",
    claims: "Không nói cà phê tốt cho sức khỏe theo kiểu chữa bệnh. Không so sánh với quán khác.", channels: "Facebook, Instagram và TikTok",
    knowledge: [
      { title: "Thực đơn và giá", kind: "pricing", content: "Cà phê phin 35.000đ. Bạc xỉu 39.000đ. Cold brew 49.000đ. Cà phê hạt rang xay đóng gói 250g: 120.000đ. Bánh croissant bơ 35.000đ." },
      { title: "Về Nhà Rang", kind: "text", content: "Nhà Rang rang cà phê tươi mỗi sáng thứ ba và thứ sáu từ hạt Arabica Cầu Đất và Robusta Đắk Lắk. Quán ở 12 Nguyễn Văn Linh, Đà Nẵng, mở cửa 7:00 đến 22:00. Có wifi mạnh và ổ cắm ở mọi bàn." },
      { title: "Chính sách", kind: "policy", content: "Giao hàng cà phê hạt trong nội thành Đà Nẵng, phí 15.000đ. Không có chương trình khuyến mãi cố định. Có thể xay hạt theo yêu cầu khi mua tại quán." },
    ],
    cadence: [
      { channel: "facebook", posts_per_week: 4, days: [1, 3, 5, 6], post_time: "18:00" },
      { channel: "instagram", posts_per_week: 2, days: [2, 6], post_time: "12:00" },
      { channel: "tiktok", posts_per_week: 2, days: [4, 7], post_time: "20:00" },
    ],
    settings: { brand_voice: "Xưng mình, gọi bạn. Vui vẻ, có thể đùa nhẹ về cà phê và deadline.", avoid: "Không chê quán khác. Không nói giảm giá nếu không có.", cta: "Ghé Nhà Rang, 12 Nguyễn Văn Linh", hashtags: ["#NhaRang", "#CafeDaNang"] },
  },
];

const ensureWorkspace = async (b: Biz): Promise<{ ws: string; ownerId: string }> => {
  const email = process.env.READY_OWNER_EMAIL;
  const users = ok(await db.auth.admin.listUsers({ perPage: 200 }), "listUsers").users;
  const owner = users.find((u) => u.email === email) ?? users[0];
  let ws = ((await db.from("workspaces").select("id").eq("name", b.name).limit(1)).data ?? [])[0]?.id as string | undefined;
  if (!ws) ws = (ok(await db.from("workspaces").insert({ name: b.name, owner_id: owner.id }).select("id").single(), "workspace") as { id: string }).id;
  const mem = await db.from("workspace_members").select("user_id").eq("workspace_id", ws).eq("user_id", owner.id).maybeSingle();
  if (!mem.data) ok(await db.from("workspace_members").insert({ workspace_id: ws, user_id: owner.id, role: "owner", display_name: "Kiểm thử (chủ)", status: "active" }).select("user_id"), "member");
  return { ws, ownerId: owner.id };
};

const setupBusiness = async (b: Biz, ws: string, ownerId: string): Promise<void> => {
  const inst = await installModuleCore(db, { workspaceId: ws, moduleKey: "content", locale: "vi", actorName: "Kiểm thử" });
  const gate = (evidence: string) => ({ status: "confirmed", evidence });
  const snapshot = {
    summary: b.summary, facts: [{ key: "shop", text: b.summary }],
    gates: { channels: gate(b.channels), audience: gate(b.audience), pillars: gate("Sản phẩm, kiến thức, khách hàng, hậu trường, ưu đãi"), cadence: gate("Theo cài đặt tần suất"), claims_limits: gate(b.claims), approval: gate("Chủ duyệt mọi bài"), tone: gate(b.tone) },
  };
  const cur = ok(await db.from("module_installations").select("active_context_version_id").eq("id", inst.installationId).single(), "installation") as { active_context_version_id: string | null };
  if (!cur.active_context_version_id) {
    const v = ok(await db.from("module_context_versions").insert({ workspace_id: ws, installation_id: inst.installationId, version: 1, snapshot, applied_by: "Kiểm thử" }).select("id").single(), "version") as { id: string };
    ok(await db.from("module_installations").update({ active_context_version_id: v.id, status: "ready" }).eq("id", inst.installationId).select("id"), "activate");
  }
  for (const k of b.knowledge) {
    const found = ok(await db.from("knowledge_sources").select("id").eq("workspace_id", ws).eq("title", k.title), "source lookup") as Array<{ id: string }>;
    const base = { kind: k.kind, title: k.title, content: k.content, status: "ready", chunk_count: 0 };
    if (found.length) ok(await db.from("knowledge_sources").update(base).eq("id", found[0].id).select("id"), "source update");
    else ok(await db.from("knowledge_sources").insert({ workspace_id: ws, ...base, created_by: ownerId }).select("id"), "source insert");
  }
  await saveSettings(db, ws, { ...b.settings, automations: { today_reminder: true, offer_draft: true, weekly_summary: true } });
  await ensurePillars(db, ws, PILLAR_PRESETS);
  ok(await db.from("content_cadence").upsert(b.cadence.map((c) => ({ workspace_id: ws, ...c })), { onConflict: "workspace_id,channel" }).select("id"), "cadence");
};

const run = async (b: Biz): Promise<Record<string, unknown>> => {
  const out: Record<string, unknown> = { workspace: b.name };
  const { ws, ownerId } = await setupBusiness0(b);
  out.workspaceId = ws;

  // ---- 1. month plan
  const monthly = new Date(Date.UTC(2026, 9, 2));
  log(`\n[${b.id}] planMonth 2026-11 ...`);
  const plan = await planMonth(db, ws, { y: 2026, m: 11, actor: "Kiểm thử", now: monthly });
  if (!plan.ok) { out.plan = { ok: false, error: plan.error, ms: plan.ms }; log("PLAN FAILED", plan.error); return out; }
  const items = await listItems(db, ws, { from: "2026-10-31T00:00:00Z", to: "2026-12-01T00:00:00Z" });
  const pillars = await listPillars(db, ws);
  const planned = items.filter((i) => i.plan_id === plan.planId);
  const quota = pillarQuota(pillars, planned.length);
  const perPillar = pillars.map((p) => ({ pillar: p.name, got: planned.filter((i) => i.pillar_id === p.id).length, want: quota.find((q) => q.pillar.id === p.id)?.count ?? 0 }));
  const holidays = [...new Set(planned.map((i) => i.holiday_key).filter(Boolean))];
  const mentionsDiscount = planned.filter((i) => /giảm\s*\d|%|giảm giá/i.test(`${i.title} ${i.brief}`)).map((i) => i.title);
  out.plan = {
    ok: true, ms: plan.ms, seconds: Math.round(plan.ms / 1000), ideas: plan.ideas, jsonValid: true, rawKeys: Object.keys(plan.raw), skippedPast: plan.skippedPast, perPillar, holidays, mentionsDiscount,
    sample: planned.slice(0, 5).map((i) => ({ at: i.scheduled_at, ch: i.channels, title: i.title, pillar: pillars.find((p) => p.id === i.pillar_id)?.name, holiday: i.holiday_key })),
  };
  log(`[${b.id}] plan ok: ${plan.ideas} ideas in ${(plan.ms / 1000).toFixed(1)}s; holidays=${holidays.join(",")}; pillars=${JSON.stringify(perPillar)}`);
  for (const s of planned.slice(0, 6)) log(`   ${s.scheduled_at} ${s.channels.join("+")} | ${s.title}`);

  // ---- 2. draft two items
  const picks = planned.filter((i) => i.status === "idea").slice(0, 2);
  const drafts: Array<Record<string, unknown>> = [];
  for (const it of picks) {
    log(`[${b.id}] draft: ${it.title}`);
    const d = await draftItem(db, ws, it.id, "Kiểm thử");
    if (!d.ok) { drafts.push({ id: it.id, ok: false, error: d.error }); log("DRAFT FAILED", d.error); continue; }
    drafts.push({
      id: it.id, ok: true, seconds: Math.round(d.ms / 1000), warnings: d.warnings, title: d.item.title,
      variants: Object.fromEntries(Object.entries(d.item.variants).map(([c, v]) => [c, { chars: v?.text.length, max: channelRule(c as ContentChannel).max_chars, hashtags: v?.hashtags, text: v?.text }])),
      media: d.item.media,
    });
    for (const [c, v] of Object.entries(d.item.variants)) log(`   [${c}] ${v?.text.length} chars | ${v?.text.replace(/\n/g, " / ").slice(0, 180)} | ${v?.hashtags.join(" ")}`);
    if (d.warnings.length) log("   warnings:", d.warnings.join(" | "));
  }
  out.drafts = drafts;

  // ---- 3. gate: send for approval -> waiting -> approve -> mark published
  const c: EngineCtx = { db, ws, actor: "Kiểm thử (chủ)", locale: "vi" };
  const flow: Record<string, unknown> = {};
  const first = picks[0];
  if (first && drafts[0]?.ok) {
    const sent = await requestPublish(c, first.id);
    const afterSubmit = await getItem(db, ws, first.id);
    flow.afterSubmit = { itemStatus: afterSubmit?.status, workItemStatus: sent.workItem.status, reason: sent.workItem.reason, action: sent.workItem.action, workItemId: sent.workItem.id };
    log(`[${b.id}] submit -> item=${afterSubmit?.status} work_item=${sent.workItem.status} (${sent.workItem.reason})`);
    const approved = await resumeWork(c, sent.workItem.id, "approved", {}, { name: "Kiểm thử (chủ)", kind: "owner" }, "Kiểm thử duyệt");
    const afterApprove = await getItem(db, ws, first.id);
    flow.afterApprove = { itemStatus: afterApprove?.status, workItemStatus: approved.status, approvedBy: afterApprove?.approved_by };
    log(`[${b.id}] approve -> item=${afterApprove?.status} work_item=${approved.status} by=${afterApprove?.approved_by}`);
    // posting before approval must be refused: the second item was never approved
    if (picks[1]) {
      let refused = false;
      try { await markPublished(db, ws, picks[1].id, { channel: picks[1].channels[0], by: "Kiểm thử", url: "https://example.com/x" }); } catch { refused = true; }
      flow.publishWithoutApprovalRefused = refused;
      log(`[${b.id}] mark published without approval refused: ${refused}`);
    }
    for (const ch of first.channels) {
      await markPublished(db, ws, first.id, { channel: ch, by: "Kiểm thử (chủ)", url: `https://example.com/kiem-thu/${first.id}/${ch}`, how: "Đăng tay" });
    }
    const done = await getItem(db, ws, first.id);
    flow.final = { status: done?.status, publishedAt: done?.published_at, published: done?.published, evidence: done?.evidence.map((e) => `${e.kind}: ${e.text}`) };
    log(`[${b.id}] final status=${done?.status}; evidence=${done?.evidence.length}`);
    const dec = ok(await db.from("decisions").select("action, outcome, decided_by").eq("workspace_id", ws).eq("action", "publish_post"), "decisions") as Array<unknown>;
    flow.decisions = dec;
  }
  out.flow = flow;
  return out;
};

const setupBusiness0 = async (b: Biz): Promise<{ ws: string; ownerId: string }> => {
  const { ws, ownerId } = await ensureWorkspace(b);
  await setupBusiness(b, ws, ownerId);
  return { ws, ownerId };
};

const automations = async (b: Biz, ws: string): Promise<Record<string, unknown>> => {
  const out: Record<string, unknown> = {};
  const now = new Date();
  const soon = new Date(now.getTime() + 3_600_000).toISOString();
  ok(await db.from("content_items").insert({ workspace_id: ws, title: "Kiểm thử nhắc lịch hôm nay", channels: ["facebook"], status: "draft", scheduled_at: soon, source: "manual", created_by: "Kiểm thử" }).select("id"), "reminder item");
  out.reminder = await todayReminder(db, ws, now, true);
  out.summary = await weeklySummary(db, ws, now, true);
  const t0 = Date.now();
  await saveSettings(db, ws, { marks: { offer_seen_at: "" } });
  const firstRun = await offerDraft(db, ws, now, false);
  ok(await db.from("knowledge_sources").insert({ workspace_id: ws, kind: "text", title: `Ưu đãi mới (kiểm thử ${now.toISOString().slice(0, 16)})`, content: "Ưu đãi mới: mua 2 tặng 1 phần quà nhỏ cho khách đặt lịch trong tuần này, đến hết 15/10. Chỉ áp dụng khi nhắn đặt trước.", status: "ready" }).select("id"), "new offer");
  out.offerFirstRun = firstRun;
  out.offerSecondRun = await offerDraft(db, ws, new Date(Date.now() + 1000), false);
  out.offerMs = Date.now() - t0;
  const msgs = ok(await db.from("messages").select("body").eq("workspace_id", ws).eq("author_kind", "system").order("created_at", { ascending: false }).limit(3), "messages") as Array<{ body: string }>;
  out.officeMessages = msgs.map((m) => m.body.slice(0, 200));
  log(`[${b.id}] automations:`, JSON.stringify(out));
  return out;
};

for (const b of BIZ) {
  if (only && b.id !== only) continue;
  try {
    const r = await run(b);
    if (b.id === "spa" && (r.workspaceId as string)) r.automations = await automations(b, r.workspaceId as string);
    results[b.id] = r;
  } catch (e) {
    results[b.id] = { error: e instanceof Error ? e.message : String(e) };
    console.error(`[${b.id}] failed:`, e);
  }
}
if (outFile) writeFileSync(outFile, JSON.stringify(results, null, 2), "utf8");
log("\nDONE");
process.exit(0);
