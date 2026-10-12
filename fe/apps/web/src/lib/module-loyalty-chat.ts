import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvidence } from "./core";
import { runWork, type EngineCtx } from "./engine";
import { activeProgram } from "./module-loyalty-events";
import { expiringSoon, formatPoints, formatVndShort, LOYALTY_REPLY_CONTRACT, redeemBlock, tierOf, type Reward } from "./module-loyalty-shared";
import { loadLedger, loadMember, loadRewards, redeemedCount, type Db } from "./module-loyalty-core";

/**
 * Loyalty in the customer chat. The chatbot answers "em còn bao nhiêu điểm" and "đổi quà gì được" from a [LOYALTY PROGRAMME] block built here from the ledger
 * (so the numbers are never the model's), and a clear "đổi quà này" becomes a gated `redeem_reward` work item (auto within the owner's limit, else a decision).
 * A customer is recognised only through what NIVO already links to the conversation (the lead, the channel account, the phone the customer gave the shop):
 * a stranger who types somebody else's phone number learns nothing.
 */
type Conv = { id: string; lead_id: string | null; channel?: string | null; external_id?: string | null };

/** The loyalty customer of a conversation, read only (a chat never creates members). */
export const customerOfConversation = async (db: Db, ws: string, conv: Conv): Promise<string | null> => {
  const refs: Array<[string, string]> = [["conversation", conv.id]];
  if (conv.lead_id) refs.push(["lead", conv.lead_id]);
  if (conv.channel && conv.external_id) refs.push(["channel", `${conv.channel}:${conv.external_id.split(":")[0]}`]);
  for (const [kind, ref] of refs) {
    const l = (await db.from("loyalty_customer_links").select("customer_id").eq("workspace_id", ws).eq("kind", kind).eq("ref", ref).maybeSingle()).data as { customer_id: string } | null;
    if (l) return l.customer_id;
  }
  if (conv.lead_id) {
    const lead = (await db.from("leads").select("phone, email").eq("workspace_id", ws).eq("id", conv.lead_id).maybeSingle()).data as { phone: string | null; email: string | null } | null;
    if (lead?.phone) {
      const c = (await db.from("loyalty_customers").select("id").eq("workspace_id", ws).eq("phone", lead.phone).maybeSingle()).data as { id: string } | null;
      if (c) return c.id;
    }
    if (lead?.email) {
      const c = (await db.from("loyalty_customers").select("id").eq("workspace_id", ws).eq("email", lead.email.toLowerCase()).maybeSingle()).data as { id: string } | null;
      if (c) return c.id;
    }
  }
  return null;
};

const rewardLineFull = (r: Reward): string =>
  `- key "${r.key}": ${r.name}, ${r.pointsCost.toLocaleString("vi-VN")} điểm${r.valueVnd ? `, trị giá ${formatVndShort(r.valueVnd)}` : ""}${r.perCustomerLimit ? `, tối đa ${r.perCustomerLimit} lần mỗi khách` : ""}${r.stock !== null ? `, còn ${r.stock}` : ""}${r.minTierKey ? `, từ hạng ${r.minTierKey}` : ""}${r.note ? ` (${r.note})` : ""}`;

/** "" when loyalty is not installed or switched off; else the facts block plus the contract addition for this turn. */
export const loyaltyChatBlock = async (db: SupabaseClient, ws: string, conv: Conv): Promise<string> => {
  const program = await activeProgram(db, ws);
  if (!program) return "";
  const cfg = program.config;
  const rewards = (await loadRewards(db, ws, true)).slice(0, 12);
  const lines = [
    "[LOYALTY PROGRAMME: authoritative facts for points, tiers and rewards; use only these]",
    `Earning: ${cfg.earn.perThousandVnd} điểm cho mỗi 1.000 ₫${cfg.earn.perVisit ? `, cộng ${cfg.earn.perVisit} điểm mỗi lượt mua` : ""}${cfg.earn.categories.map((c) => `; nhóm "${c.label || c.match}": ${c.perThousandVnd} điểm mỗi 1.000 ₫`).join("")}.`,
    `Tiers (by lifetime spend): ${cfg.tiers.map((t) => `${t.name} từ ${formatVndShort(t.minSpendVnd)}${t.benefit ? ` (${t.benefit})` : ""}`).join("; ")}.`,
    cfg.expiry.months > 0 ? `Points expire ${cfg.expiry.months} tháng sau khi được cộng.` : "Points never expire.",
    rewards.length ? `Reward catalogue:\n${rewards.map(rewardLineFull).join("\n")}` : "Reward catalogue: (chưa có quà nào)",
  ];
  const id = await customerOfConversation(db, ws, conv);
  const m = id ? await loadMember(db, ws, id) : null;
  if (m) {
    const ledger = await loadLedger(db, ws, m.id, 2000);
    const exp = cfg.expiry.months > 0 ? expiringSoon(ledger, new Date(), cfg.expiry.warnDays) : { points: 0, firstAt: null };
    const can: Array<string> = [];
    for (const r of rewards) if (!redeemBlock(cfg, r, { points: m.points, tierKey: m.tierKey, redeemedBefore: await redeemedCount(db, m.id, r.id) })) can.push(`"${r.key}" (${r.name})`);
    lines.push(
      `THIS CUSTOMER (recognised): ${m.name}; tier ${tierOf(cfg, m.tierKey)?.name ?? "chưa có"}; ${formatPoints(m.points)}; total spend ${formatVndShort(m.lifetimeSpendVnd)}; ${m.visits} lượt mua.`,
      exp.points > 0 && exp.firstAt ? `Points expiring soon: ${formatPoints(exp.points)} từ ${exp.firstAt.slice(0, 10)}.` : "No points expiring soon.",
      can.length ? `Can redeem right now: ${can.join(", ")}.` : "Cannot redeem any reward right now (not enough points or limits reached).",
    );
  } else {
    lines.push("THIS CUSTOMER: not recognised as a member yet.");
    await logEvidence(db, ws, { lead_id: conv.lead_id, kind: "loyalty.chat_unrecognised", actor: "NIVO", summary: "Chat về điểm thưởng nhưng chưa nhận ra khách này là thành viên", evidence: `conversation ${conv.id}; lead ${conv.lead_id ?? "-"}; customer ${id ?? "-"}` });
  }
  lines.push("", LOYALTY_REPLY_CONTRACT);
  return lines.join("\n");
};

/** The model proposed a redeem. Returns true when a gated redeem_reward item was opened. */
export const applyLoyaltyIntent = async (
  c: EngineCtx, conv: Conv, intent: { intent?: unknown; reward_key?: unknown } | null | undefined, messageId: string,
): Promise<boolean> => {
  if (!intent || intent.intent !== "redeem" || typeof intent.reward_key !== "string") return false;
  const db = c.db;
  const program = await activeProgram(db, c.ws);
  if (!program) return false;
  const id = await customerOfConversation(db, c.ws, conv);
  if (!id) return false;
  const [m, rewards] = await Promise.all([loadMember(db, c.ws, id), loadRewards(db, c.ws, true)]);
  const reward = rewards.find((r) => r.key === intent.reward_key);
  if (!m || !reward) return false;
  const block = redeemBlock(program.config, reward, { points: m.points, tierKey: m.tierKey, redeemedBefore: await redeemedCount(db, m.id, reward.id) });
  if (block) {
    await logEvidence(db, c.ws, { lead_id: conv.lead_id, kind: "loyalty.redeem_blocked", actor: "NIVO", summary: `${m.name} xin đổi "${reward.name}" nhưng chưa đổi được: ${block}` });
    return false;
  }
  await runWork(c, {
    action: "redeem_reward", subject_type: "conversation", subject_id: conv.id, lead_id: conv.lead_id, origin: "live", dedupeKey: `redeem_reward:message:${messageId}`, preset: true, noChain: true,
    seed: {
      summary: `${m.name} xin đổi "${reward.name}" (${formatPoints(reward.pointsCost)}, trị giá ${formatVndShort(reward.valueVnd)})`, amount_vnd: reward.valueVnd,
      fields: { customer: m.name, customer_id: m.id, reward_id: reward.id, reward: reward.name, amount_vnd: reward.valueVnd, conversation_id: conv.id, source: "chat" },
    },
  });
  return true;
};
