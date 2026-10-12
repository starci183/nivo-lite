"use server";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  loadLedger, loadMember, loadRewards, programBySlug, reachOf, redeemedCount, shopNameOf,
} from "@/lib/module-loyalty-core";
import { sendToCustomerChat } from "@/lib/module-loyalty-performers";
import {
  MESSAGE_TEMPLATES, expiringSoon, fillLoyaltyBody, nextTier, normalisePhone, redeemBlock, tierOf,
} from "@/lib/module-loyalty-shared";

/**
 * The public points check (/l/<workspace slug>). A customer types their phone; if it belongs to a member who has a chat with the shop on a PUSH channel
 * (Telegram or Zalo), a 6-digit code is sent THERE (never by SMS, no SMS provider exists in NIVO) and they type it back to see their points. The answer to
 * "send the code" is always the same, so the page cannot be used to find out who is a member. Codes live 10 minutes, are stored hashed, allow 5 tries, and a
 * phone gets at most 3 codes per 10 minutes (a workspace at most 30 per hour).
 */
export type PublicRewardLine = { name: string; pointsCost: number; canRedeem: boolean; note: string };
export type PublicResult = {
  shop: string; name: string; tierName: string | null; points: number; nextTier: { name: string; missingVnd: number } | null;
  expiring: { points: number; firstAt: string | null }; rewards: Array<PublicRewardLine>;
};

const pepper = (): string => process.env.CHANNEL_TOKEN_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "nivo";
const hashCode = (customerId: string, code: string): string => createHash("sha256").update(`${pepper()}:${customerId}:${code}`).digest("hex");
const MINUTE = 60_000;

export async function requestCodeAction(slug: string, phoneRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const phone = normalisePhone(phoneRaw);
  if (!phone) return { ok: false, error: "Số điện thoại chưa đúng. Hãy nhập số bạn đã dùng khi mua hàng." };
  const db = supabaseAdmin();
  const program = await programBySlug(db, slug.toLowerCase());
  if (!program) return { ok: false, error: "Trang này không còn hoạt động." };
  const ws = program.workspaceId;
  const hourAgo = new Date(Date.now() - 60 * MINUTE).toISOString();
  const hour = (await db.from("loyalty_otps").select("id", { count: "exact", head: true }).eq("workspace_id", ws).gte("created_at", hourAgo)).count ?? 0;
  if (hour >= 30) return { ok: false, error: "Hệ thống đang nhận quá nhiều yêu cầu. Hãy thử lại sau ít phút." };
  const same = { ok: true as const };
  const customer = (await db.from("loyalty_customers").select("id").eq("workspace_id", ws).eq("phone", phone).maybeSingle()).data as { id: string } | null;
  if (!customer) return same;
  const recent = (await db.from("loyalty_otps").select("id", { count: "exact", head: true }).eq("customer_id", customer.id).gte("created_at", new Date(Date.now() - 10 * MINUTE).toISOString())).count ?? 0;
  if (recent >= 3) return same;
  const reach = await reachOf(db, ws, customer.id);
  if (!reach.conversationId || (reach.channel !== "telegram" && reach.channel !== "zalo")) return same;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const ins = await db.from("loyalty_otps").insert({ workspace_id: ws, customer_id: customer.id, code_hash: hashCode(customer.id, code), expires_at: new Date(Date.now() + 10 * MINUTE).toISOString() }).select("id").single();
  if (ins.error) return same;
  const text = fillLoyaltyBody(MESSAGE_TEMPLATES.otp, { ten_shop: await shopNameOf(db, ws), ma: code });
  const sent = await sendToCustomerChat(db, ws, reach.conversationId, text).catch(() => null);
  // A code that could not be pushed to the customer's own chat is useless: drop it.
  if (!sent?.pushed) await db.from("loyalty_otps").delete().eq("id", (ins.data as { id: string }).id);
  return same;
}

export async function verifyCodeAction(slug: string, phoneRaw: string, codeRaw: string): Promise<{ ok: true; result: PublicResult } | { ok: false; error: string }> {
  const phone = normalisePhone(phoneRaw);
  const code = codeRaw.replace(/\D/g, "");
  const wrong = { ok: false as const, error: "Mã chưa đúng hoặc đã hết hạn. Hãy yêu cầu mã mới." };
  if (!phone || code.length !== 6) return wrong;
  const db = supabaseAdmin();
  const program = await programBySlug(db, slug.toLowerCase());
  if (!program) return { ok: false, error: "Trang này không còn hoạt động." };
  const ws = program.workspaceId;
  const customer = (await db.from("loyalty_customers").select("id").eq("workspace_id", ws).eq("phone", phone).maybeSingle()).data as { id: string } | null;
  if (!customer) return wrong;
  const otp = (await db.from("loyalty_otps").select("id, code_hash, attempts").eq("customer_id", customer.id).is("used_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle()).data as { id: string; code_hash: string; attempts: number } | null;
  if (!otp || otp.attempts >= 5) return wrong;
  const a = Buffer.from(otp.code_hash, "hex");
  const b = Buffer.from(hashCode(customer.id, code), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.from("loyalty_otps").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
    return wrong;
  }
  await db.from("loyalty_otps").update({ used_at: new Date().toISOString() }).eq("id", otp.id);
  const [member, rewards, ledger] = await Promise.all([loadMember(db, ws, customer.id), loadRewards(db, ws, true), loadLedger(db, ws, customer.id, 2000)]);
  if (!member) return wrong;
  const cfg = program.config;
  const lines: Array<PublicRewardLine> = [];
  for (const r of rewards) lines.push({ name: r.name, pointsCost: r.pointsCost, note: r.note, canRedeem: !redeemBlock(cfg, r, { points: member.points, tierKey: member.tierKey, redeemedBefore: await redeemedCount(db, member.id, r.id) }) });
  const next = nextTier(cfg, member.lifetimeSpendVnd);
  return {
    ok: true,
    result: {
      shop: await shopNameOf(db, ws), name: member.name, tierName: tierOf(cfg, member.tierKey)?.name ?? null, points: member.points,
      nextTier: next ? { name: next.tier.name, missingVnd: next.missingVnd } : null,
      expiring: cfg.expiry.months > 0 ? expiringSoon(ledger, new Date(), cfg.expiry.warnDays) : { points: 0, firstAt: null }, rewards: lines,
    },
  };
}

