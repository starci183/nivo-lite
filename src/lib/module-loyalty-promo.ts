import "server-only";
import { runWork, type EngineCtx } from "./engine";
import { hhmmToMinutes, vnClock } from "./automation-hours";
import { generateWithOpenClaw } from "./openclaw-generate";
import { loadShopContext } from "./automation-queries";
import { loadMembers, loadProgram, reachOf, shopNameOf, type Db } from "./module-loyalty-core";
import {
  MESSAGE_TEMPLATES, fillLoyaltyBody, inSegment, resolveSegment, segmentLabel, tierOf, type LoyaltyConfig, type Member, type Segment,
} from "./module-loyalty-shared";

/**
 * Promotions to a segment. ONE campaign is ONE gate decision (`send_promo`, ask by default): the owner approves the OpenClaw draft once, then the sends go
 * to each customer through their own conversation, a few per minute, only inside the allowed hours, and never more than the monthly cap per customer.
 */
export type SegmentPreview = { total: number; reachable: number; sample: Array<{ id: string; name: string; tierKey: string | null }> };

export const segmentMembers = (members: ReadonlyArray<Member>, segment: Segment, nowIso: string): Array<Member> => members.filter((m) => inSegment(m, segment, nowIso));

export const previewSegment = async (db: Db, ws: string, segment: Segment): Promise<SegmentPreview> => {
  const members = segmentMembers(await loadMembers(db, ws), segment, new Date().toISOString());
  let reachable = 0;
  const sample: SegmentPreview["sample"] = [];
  for (const m of members.slice(0, 200)) {
    const r = await reachOf(db, ws, m.id);
    if (r.conversationId && !r.handledBy) reachable += 1;
    if (sample.length < 5) sample.push({ id: m.id, name: m.name, tierKey: m.tierKey });
  }
  return { total: members.length, reachable: members.length > 200 ? Math.round((reachable / 200) * members.length) : reachable, sample };
};

/* ------------------------------------------------------------------ the draft (OpenClaw) */

const acceptable = (text: string): boolean => !!text && text.length <= 700 && !/\*\*|^#|```/m.test(text) && text.includes("{ten_khach}") && !/\{(?!ten_khach\}|ten_shop\}|diem\}|hang\})[a-z_]+\}/.test(text);

export type Draft = { text: string; generated: boolean; ms: number; reason: string | null };

/** The promotion text with {ten_khach} for each customer. OpenClaw writes it from the shop's context and the owner's brief; no answer in time = the data template, labelled as such. */
export const draftPromo = async (db: Db, ws: string, p: { brief: string; segment: Segment; config: LoyaltyConfig }): Promise<Draft> => {
  const t0 = Date.now();
  const shop = await loadShopContext(db, ws);
  const who = segmentLabel(p.config, p.segment);
  const base = fillLoyaltyBody(MESSAGE_TEMPLATES.promo, { ten_khach: "{ten_khach}", ten_shop: shop.shop, uu_dai: p.brief.trim() || "ưu đãi riêng cho khách thân thiết" });
  try {
    const system = [
      "Write ONE promotion message from a shop to a loyalty-programme customer, to be sent through their chat (Zalo, Telegram or website).",
      "Vietnamese, warm and plain, no markdown, no emojis unless the shop's tone uses them, at most 60 words.",
      "Start by greeting the customer with the placeholder {ten_khach}. You may also use {ten_shop}, {diem} (their points) and {hang} (their tier). Use no other placeholders.",
      "Mention ONLY the offer the owner wrote. Never invent a discount, gift, price, date or condition that the owner did not write. End with one easy next step.",
      "Output only the message.",
    ].join("\n");
    const prompt = [
      `Shop: ${shop.shop}`, shop.tone ? `Tone: ${shop.tone}` : "", `Customers receiving it: ${who}`, `Tiers: ${p.config.tiers.map((t) => t.name).join(", ")}`,
      `The owner's offer / brief: ${p.brief.trim() || "(none: keep it a friendly thank-you without any offer)"}`,
    ].filter(Boolean).join("\n");
    const r = await generateWithOpenClaw({
      workspaceId: ws, purpose: "loyalty_promo_draft", kind: "engine", module: "other", timeoutMs: 45_000,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    });
    const ms = Date.now() - t0;
    if (!r.ok) return { text: base, generated: false, ms, reason: r.reason };
    const text = r.output.trim().replace(/^["“”']|["“”']$/g, "").trim();
    return acceptable(text) ? { text, generated: true, ms, reason: null } : { text: base, generated: false, ms, reason: "unusable" };
  } catch (e) {
    console.error("loyalty promo draft failed:", e instanceof Error ? e.message : e);
    return { text: base, generated: false, ms: Date.now() - t0, reason: "error" };
  }
};

/* ------------------------------------------------------------------ campaigns */

export type CampaignView = {
  id: string; name: string; segment: Segment; draft: string; status: string; workItemId: string | null; recipients: number;
  sent: number; queued: number; failed: number; skipped: number; draftMs: number | null; createdBy: string; createdAt: string; finishedAt: string | null;
};

type CampaignRow = {
  id: string; name: string; segment: unknown; draft: string; status: string; work_item_id: string | null; recipients: number; draft_ms: number | null;
  created_by: string; created_at: string; finished_at: string | null;
};

export const loadCampaigns = async (db: Db, ws: string, limit = 20): Promise<Array<CampaignView>> => {
  const rows = ((await db.from("loyalty_campaigns").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(limit)).data ?? []) as Array<CampaignRow>;
  if (!rows.length) return [];
  const sends = ((await db.from("loyalty_sends").select("campaign_id, status").eq("workspace_id", ws).in("campaign_id", rows.map((r) => r.id)).limit(5000)).data ?? []) as Array<{ campaign_id: string; status: string }>;
  const count = (id: string, st: string) => sends.filter((s) => s.campaign_id === id && s.status === st).length;
  return rows.map((r) => ({
    id: r.id, name: r.name, segment: resolveSegment(r.segment), draft: r.draft, status: r.status, workItemId: r.work_item_id, recipients: r.recipients,
    sent: count(r.id, "sent"), queued: count(r.id, "queued"), failed: count(r.id, "failed"), skipped: count(r.id, "skipped"), draftMs: r.draft_ms, createdBy: r.created_by,
    createdAt: r.created_at, finishedAt: r.finished_at,
  }));
};

/**
 * Draft the message for a segment and put the send through the gate. Returns the campaign with the work item's state: "waiting_decision" (the owner decides in
 * Office or the Quyết định tab), "done" (the owner's rule lets it go by itself), "failed". Nothing reaches a customer here.
 */
export const createCampaign = async (c: EngineCtx & { db: Db }, p: { name: string; segment: Segment; brief: string; by: string }): Promise<{ campaignId: string; status: string; draft: Draft; recipients: number; workItemId: string | null }> => {
  const db = c.db;
  const program = await loadProgram(db, c.ws);
  if (!program) throw new Error("Chương trình chưa được tạo.");
  const segment = resolveSegment(p.segment);
  const members = segmentMembers(await loadMembers(db, c.ws), segment, new Date().toISOString());
  if (members.length === 0) throw new Error("Không có khách nào khớp bộ lọc này.");
  const draft = await draftPromo(db, c.ws, { brief: p.brief, segment, config: program.config });
  const name = (p.name.trim() || `Ưu đãi ${segmentLabel(program.config, segment)}`).slice(0, 100);
  const ins = await db.from("loyalty_campaigns").insert({
    workspace_id: c.ws, name, segment, draft: draft.text, status: "waiting", recipients: members.length, draft_ms: draft.ms, created_by: p.by,
  }).select("id").single();
  if (ins.error) throw new Error(ins.error.message);
  const campaignId = (ins.data as { id: string }).id;
  const item = await runWork(c, {
    action: "send_promo", subject_type: "lead", subject_id: null, lead_id: null, origin: "live", dedupeKey: `send_promo:campaign:${campaignId}`, preset: true, noChain: true,
    seed: {
      summary: `Gửi ưu đãi "${name}" tới ${members.length} khách (${segmentLabel(program.config, segment)})`, draft: draft.text,
      fields: { campaign_id: campaignId, contact: `${members.length} khách`, customer: segmentLabel(program.config, segment), draft_source: draft.generated ? "openclaw" : "mẫu có sẵn" },
    },
  });
  const status = item.status === "waiting_decision" ? "waiting" : item.status === "done" ? "sending" : item.status === "failed" ? "failed" : "waiting";
  await db.from("loyalty_campaigns").update({ work_item_id: item.id, status }).eq("id", campaignId);
  return { campaignId, status: item.status, draft, recipients: members.length, workItemId: item.id };
};

/* ------------------------------------------------------------------ sending */

const monthAgo = (): string => new Date(Date.now() - 30 * 86_400_000).toISOString();

/** The queue of one campaign is filled from the segment AS IT IS NOW (a customer who stopped matching is not sent to), then the first batch goes out. */
export const runCampaignSends = async (
  db: Db, ws: string, campaignId: string, o: { approvedBy: string; draft?: string; workItemId?: string },
): Promise<{ name: string; recipients: number; sentNow: number; queued: number; skipped: number }> => {
  const camp = (await db.from("loyalty_campaigns").select("*").eq("workspace_id", ws).eq("id", campaignId).maybeSingle()).data as CampaignRow | null;
  if (!camp) throw new Error("Không tìm thấy chiến dịch này.");
  const program = await loadProgram(db, ws);
  if (!program) throw new Error("Chương trình chưa được tạo.");
  if (o.draft && o.draft !== camp.draft) await db.from("loyalty_campaigns").update({ draft: o.draft }).eq("id", campaignId);
  const members = segmentMembers(await loadMembers(db, ws), resolveSegment(camp.segment), new Date().toISOString());
  const have = new Set((((await db.from("loyalty_sends").select("customer_id").eq("campaign_id", campaignId)).data ?? []) as Array<{ customer_id: string }>).map((r) => r.customer_id));
  let skipped = 0;
  const rows: Array<Record<string, unknown>> = [];
  for (const m of members) {
    if (have.has(m.id)) continue;
    const r = await reachOf(db, ws, m.id);
    if (!r.conversationId || r.handledBy) {
      rows.push({ workspace_id: ws, campaign_id: campaignId, customer_id: m.id, lead_id: r.leadId, conversation_id: r.conversationId, status: "skipped", error: r.handledBy ? "Đang có nhân viên trực tiếp trả lời khách này." : "Khách chưa có cuộc trò chuyện để nhắn." });
      skipped += 1;
    } else rows.push({ workspace_id: ws, campaign_id: campaignId, customer_id: m.id, lead_id: r.leadId, conversation_id: r.conversationId, status: "queued" });
  }
  if (rows.length) {
    const ins = await db.from("loyalty_sends").insert(rows);
    if (ins.error) throw new Error(ins.error.message);
  }
  await db.from("loyalty_campaigns").update({ status: "sending", recipients: members.length, ...(o.workItemId ? { work_item_id: o.workItemId } : {}) }).eq("id", campaignId);
  const before = (await db.from("loyalty_sends").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", "sent")).count ?? 0;
  await sendQueuedPromos(db, ws, program.config, new Date());
  const after = (await db.from("loyalty_sends").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", "sent")).count ?? 0;
  const queued = (await db.from("loyalty_sends").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", "queued")).count ?? 0;
  if (queued === 0) await db.from("loyalty_campaigns").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", campaignId);
  return { name: camp.name, recipients: members.length, sentNow: after - before, queued, skipped };
};

/**
 * One tick of the sender: at most `batch` messages per workspace, only inside the allowed hours (Vietnam time), never more than the monthly cap per customer.
 * A message that cannot be pushed to the channel is recorded as failed (the text stays in the conversation); the rest of the queue is untouched.
 */
export const sendQueuedPromos = async (db: Db, ws: string, config: LoyaltyConfig, now: Date): Promise<number> => {
  const clock = vnClock(now);
  if (clock.minute < hhmmToMinutes(config.promo.hourFrom) || clock.minute >= hhmmToMinutes(config.promo.hourTo)) return 0;
  const queued = ((await db.from("loyalty_sends").select("id, campaign_id, customer_id, conversation_id").eq("workspace_id", ws).eq("status", "queued").order("created_at").limit(config.promo.batch)).data ?? []) as Array<{ id: string; campaign_id: string; customer_id: string; conversation_id: string | null }>;
  if (!queued.length) return 0;
  const { sendToCustomerChat } = await import("./module-loyalty-performers");
  const camps = new Map<string, CampaignRow>();
  for (const id of new Set(queued.map((q) => q.campaign_id))) {
    const c = (await db.from("loyalty_campaigns").select("*").eq("id", id).maybeSingle()).data as CampaignRow | null;
    if (c) camps.set(id, c);
  }
  const shop = await shopNameOf(db, ws);
  const members = new Map((await loadMembers(db, ws)).map((m) => [m.id, m]));
  let sent = 0;
  for (const q of queued) {
    const camp = camps.get(q.campaign_id);
    const m = members.get(q.customer_id);
    if (!camp || !m || !q.conversation_id) {
      await db.from("loyalty_sends").update({ status: "skipped", error: "Không còn đủ thông tin để gửi." }).eq("id", q.id);
      continue;
    }
    const recent = (await db.from("loyalty_sends").select("id", { count: "exact", head: true }).eq("customer_id", q.customer_id).eq("status", "sent").gte("sent_at", monthAgo())).count ?? 0;
    if (recent >= config.promo.maxPerMonth) {
      await db.from("loyalty_sends").update({ status: "skipped", error: `Đã đủ ${config.promo.maxPerMonth} tin ưu đãi trong 30 ngày.` }).eq("id", q.id);
      continue;
    }
    const body = fillLoyaltyBody(camp.draft, { ten_khach: m.name, ten_shop: shop, diem: m.points.toLocaleString("vi-VN"), hang: tierOf(config, m.tierKey)?.name ?? "" });
    try {
      const out = await sendToCustomerChat(db, ws, q.conversation_id, body);
      await db.from("loyalty_sends").update({ status: out.real ? "sent" : "failed", body, sent_at: now.toISOString(), error: out.real ? null : "Kênh chat của khách không nhận được tin (đã lưu trong cuộc trò chuyện)." }).eq("id", q.id);
      sent += 1;
    } catch (e) {
      await db.from("loyalty_sends").update({ status: "failed", body, error: (e instanceof Error ? e.message : String(e)).slice(0, 200) }).eq("id", q.id);
    }
  }
  // Close the campaigns whose queue is empty.
  for (const id of camps.keys()) {
    const left = (await db.from("loyalty_sends").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "queued")).count ?? 0;
    if (left === 0) await db.from("loyalty_campaigns").update({ status: "done", finished_at: now.toISOString() }).eq("id", id).eq("status", "sending");
  }
  return sent;
};
