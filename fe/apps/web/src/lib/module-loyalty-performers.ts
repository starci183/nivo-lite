import "server-only";
import { logEvidence } from "./core";
import type { EngineCtx, Performer } from "./engine";
import type { Proposal, WorkItem } from "./flow-types";
import { supabaseAdmin } from "./supabase/admin";
import { deliverToChannel } from "./telegram";
import {
  adjustPoints, earnForPurchase, expiryDate, ensureProgram, loadMember, loadReward, postLedger, reachOf, redeemRewardNow, resolveCustomer, type Db,
} from "./module-loyalty-core";
import { runCampaignSends } from "./module-loyalty-promo";
import { formatPoints, formatVndShort } from "./module-loyalty-shared";

/**
 * What actually happens once the authority gate lets a loyalty action through (automatically, or after a person approved it):
 *   award_points   put points on the ledger (a purchase, or a fixed bonus such as the birthday gift) and announce a tier upgrade
 *   redeem_reward  take the points, give the reward a code, tell the customer
 *   send_promo     one customer (an automation) or a whole campaign (the segment sender); only here may a promotion reach a customer
 * The loyalty tables are written with the service role (members only read them), the gate has already decided, and every write is idempotent on its `ref`.
 */
const str = (v: unknown): string => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

/** Put one message into the customer's newest real conversation and push it to the channel when it has one. */
export const sendToCustomerChat = async (db: Db, ws: string, conversationId: string, text: string): Promise<{ pushed: boolean; channel: string; real: boolean }> => {
  await db.from("agent_messages").insert({ workspace_id: ws, conversation_id: conversationId, role: "agent", body: text });
  const channel = ((await db.from("agent_conversations").select("channel").eq("id", conversationId).maybeSingle()).data as { channel: string | null } | null)?.channel ?? "website";
  const pushed = await deliverToChannel(db, conversationId, text);
  // The website chat has no push: the text sits in the conversation and the customer sees it when they open the chat. Telegram and Zalo must really accept it.
  return { pushed, channel, real: pushed || channel === "website" };
};

/* ------------------------------------------------------------------ award_points */

const awardPoints: Performer = {
  prepare: async (_c, item) => ({ proposal: item.proposal }),
  perform: async (c, item, p, by) => {
    const db = supabaseAdmin();
    const ws = c.ws;
    const f = p.fields;
    const customerId = str(f.customer_id);
    if (!customerId) throw new Error("Thiếu khách để cộng điểm.");
    const program = await ensureProgram(db, ws);
    const member = await loadMember(db, ws, customerId);
    if (!member) throw new Error("Không tìm thấy khách trong chương trình.");
    const who = by.name === "NIVO" ? "NIVO" : by.name;
    if (str(f.mode) === "bonus") {
      const points = Math.round(num(f.points));
      const posted = await postLedger(db, {
        ws, customerId, kind: "earn", points, ref: str(f.ref), by: who, workItemId: item.id, evidence: str(f.reason) || "Điểm thưởng của chương trình",
        expiresAt: expiryDate(program.config, new Date()),
      });
      const summary = posted ? `Đã cộng ${formatPoints(points)} cho ${member.name} (${str(f.reason) || "điểm thưởng"}).` : `Điểm thưởng này đã được cộng trước đó cho ${member.name}.`;
      await logEvidence(db, ws, { lead_id: item.lead_id, work_item_id: item.id, kind: "loyalty.bonus", actor: who, summary, evidence: str(f.ref) });
      return { summary, evidence: "captured", lead_id: item.lead_id };
    }
    const r = await earnForPurchase(db, ws, program.config, {
      customerId, amountVnd: num(f.amount_vnd), items: str(f.items), ref: str(f.ref), by: who, orderId: str(f.order_id) || null, invoiceId: str(f.invoice_id) || null, workItemId: item.id, occurredAt: str(f.occurred_at) || null,
    });
    const summary = !r.posted
      ? r.points === 0 ? `Không cộng điểm cho ${member.name}: ${r.note}` : `Đơn này đã được cộng điểm trước đó cho ${member.name}.`
      : `Đã cộng ${formatPoints(r.points)} cho ${member.name} (${formatVndShort(num(f.amount_vnd))}; ${r.note}).`;
    await logEvidence(db, ws, { lead_id: item.lead_id, work_item_id: item.id, kind: "loyalty.earned", actor: who, summary, evidence: str(f.ref) });
    if (r.tierUp) {
      await logEvidence(db, ws, {
        lead_id: item.lead_id, work_item_id: item.id, kind: "loyalty.tier_up", actor: "NIVO",
        summary: `${member.name} lên hạng ${r.tierUp.to.name}${r.tierUp.from ? ` (từ ${r.tierUp.from.name})` : ""}.`, evidence: r.tierUp.to.benefit,
      });
      try {
        const { fireTemplate } = await import("./automation-engine");
        await fireTemplate(ws, "loyalty_tier_up", `tier:${customerId}:${r.tierUp.to.key}`, customerId, { customer_id: customerId, tier_key: r.tierUp.to.key, from: r.tierUp.from?.key ?? null });
      } catch (e) {
        console.error("loyalty tier-up automation failed:", e instanceof Error ? e.message : e);
      }
    }
    return { summary, evidence: r.posted ? "verified" : "captured", lead_id: item.lead_id };
  },
};

/* ------------------------------------------------------------------ redeem_reward */

const redeemReward: Performer = {
  prepare: async (_c, item) => ({ proposal: item.proposal }),
  perform: async (c, item, p, by) => {
    const db = supabaseAdmin();
    const ws = c.ws;
    const f = p.fields;
    const program = await ensureProgram(db, ws);
    const reward = await loadReward(db, ws, str(f.reward_id));
    if (!reward) throw new Error("Phần quà này không còn trong danh mục.");
    const member = await loadMember(db, ws, str(f.customer_id));
    if (!member) throw new Error("Không tìm thấy khách trong chương trình.");
    // The owner may have edited the amount while approving; the points always follow the catalogue, never the edited number.
    const out = await redeemRewardNow(db, ws, program.config, { customerId: member.id, reward, ref: `redeem:${item.id}`, by: by.name === "NIVO" ? "NIVO" : by.name, workItemId: item.id });
    const after = await loadMember(db, ws, member.id);
    const summary = out.posted
      ? `Đã đổi "${reward.name}" cho ${member.name} (mã ${out.code}, trừ ${formatPoints(reward.pointsCost)}).`
      : `Lượt đổi này đã được ghi trước đó cho ${member.name} (mã ${out.code}).`;
    await logEvidence(db, ws, { lead_id: item.lead_id, work_item_id: item.id, kind: "loyalty.redeemed", actor: by.name, summary, evidence: `Mã ${out.code}` });
    const convId = str(f.conversation_id);
    if (out.posted && convId) {
      const text = `Em đã đổi quà "${reward.name}" cho ${member.name} rồi ạ. Mã nhận quà: ${out.code}. Điểm còn lại: ${formatPoints(after?.points ?? 0)}.`;
      await sendToCustomerChat(db, ws, convId, text).catch((e: unknown) => console.error("redeem notice failed:", e instanceof Error ? e.message : e));
    }
    return { summary, evidence: "captured", lead_id: item.lead_id, detail: out.code };
  },
};

/* ------------------------------------------------------------------ adjust_points */

/** A manual correction (extra points, or points taken back). Always a decision with a reason: the person who approves is on record. */
const adjustPointsPerformer: Performer = {
  prepare: async (_c, item) => ({ proposal: item.proposal }),
  perform: async (c, item, p, by) => {
    const db = supabaseAdmin();
    const f = p.fields;
    const member = await loadMember(db, c.ws, str(f.customer_id));
    if (!member) throw new Error("Không tìm thấy khách trong chương trình.");
    const points = Math.round(num(f.points));
    const reason = str(f.reason);
    const posted = await adjustPoints(db, c.ws, { customerId: member.id, points, reason, by: by.name, ref: `adjust:${item.id}`, workItemId: item.id });
    const summary = posted ? `Đã ${points > 0 ? "cộng" : "trừ"} ${formatPoints(Math.abs(points))} cho ${member.name} (${reason}).` : `Lần chỉnh điểm này đã được ghi trước đó cho ${member.name}.`;
    await logEvidence(db, c.ws, { lead_id: item.lead_id, work_item_id: item.id, kind: "loyalty.adjusted", actor: by.name, summary, evidence: reason });
    return { summary, evidence: "reviewed", lead_id: item.lead_id };
  },
};

/* ------------------------------------------------------------------ send_promo */

const promoOne = async (c: EngineCtx, item: WorkItem, p: Proposal): Promise<{ summary: string; leadId: string | null }> => {
  const db = supabaseAdmin();
  const ws = c.ws;
  const text = (p.draft ?? "").trim();
  if (!text) throw new Error("Tin nhắn trống.");
  // The conversation: the one named on the item, else the newest real conversation of the item's lead.
  let convId = str(p.fields.conversation_id);
  let name = str(p.fields.customer) || "khách";
  if (!convId && item.lead_id) {
    const cust = await resolveCustomer(db, ws, { leadId: item.lead_id });
    if (cust) convId = (await reachOf(db, ws, cust.id)).conversationId ?? "";
  }
  if (!convId) {
    const conv = ((await db.from("agent_conversations").select("id, visitor_name").eq("workspace_id", ws).eq("lead_id", item.lead_id ?? "").eq("kind", "customer").order("created_at", { ascending: false }).limit(1)).data ?? [])[0] as { id: string; visitor_name: string | null } | undefined;
    convId = conv?.id ?? "";
    name = name === "khách" ? conv?.visitor_name ?? name : name;
  }
  if (!convId) throw new Error(`${name} chưa có cuộc trò chuyện nào để NIVO nhắn.`);
  const sent = await sendToCustomerChat(db, ws, convId, text);
  return { summary: sent.pushed ? `Đã gửi tin ưu đãi cho ${name} qua kênh chat của khách.` : `Đã lưu tin ưu đãi trong cuộc trò chuyện với ${name} (khách xem khi mở lại khung chat).`, leadId: item.lead_id };
};

const sendPromo: Performer = {
  prepare: async (_c, item) => ({ proposal: item.proposal }),
  perform: async (c, item, p, by) => {
    const campaignId = str(p.fields.campaign_id);
    if (!campaignId) {
      const one = await promoOne(c, item, p);
      await logEvidence(supabaseAdmin(), c.ws, { lead_id: one.leadId, work_item_id: item.id, kind: "loyalty.promo_sent", actor: by.name, summary: one.summary, evidence: p.draft ?? null });
      return { summary: one.summary, evidence: "captured", lead_id: one.leadId, detail: p.draft ?? null };
    }
    const db = supabaseAdmin();
    // The owner may have edited the message while approving: that text is what goes out.
    const edited = (p.draft ?? "").trim();
    const run = await runCampaignSends(db, c.ws, campaignId, { approvedBy: by.name, draft: edited || undefined, workItemId: item.id });
    const summary = `Đã duyệt gửi ưu đãi "${run.name}" tới ${run.recipients} khách: gửi ngay ${run.sentNow}${run.queued ? `, còn ${run.queued} khách sẽ gửi dần trong giờ cho phép` : ""}${run.skipped ? `, bỏ qua ${run.skipped}` : ""}.`;
    await logEvidence(db, c.ws, { work_item_id: item.id, kind: "loyalty.campaign_started", actor: by.name, summary, evidence: edited || null });
    return { summary, evidence: "captured", detail: edited || null };
  },
  onReject: async (c, item) => {
    const id = str(item.proposal.fields?.campaign_id);
    if (id) await supabaseAdmin().from("loyalty_campaigns").update({ status: "rejected", finished_at: new Date().toISOString() }).eq("workspace_id", c.ws).eq("id", id).in("status", ["waiting", "draft"]);
  },
};

export const LOYALTY_PERFORMERS = { award_points: awardPoints, redeem_reward: redeemReward, send_promo: sendPromo, adjust_points: adjustPointsPerformer } as const;

