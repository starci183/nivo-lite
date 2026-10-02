import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError, field } from "./api-v1";
import type { ApiPrincipal } from "./api-keys";
import { runWork, type EngineCtx } from "./engine";
import { supabaseAdmin } from "./supabase/admin";
import { activeProgram, startAward } from "./module-loyalty-events";
import { loadMember, loadMembers, loadRewards, redeemedCount, reachOf } from "./module-loyalty-core";
import { createCampaign } from "./module-loyalty-promo";
import { formatPoints, formatVndShort, normalisePhone, redeemBlock, resolveSegment, tierOf } from "./module-loyalty-shared";

/**
 * The loyalty endpoints of the public API (scopes loyalty:read / loyalty:write), for a till or POS that is not part of NIVO's own sales flow. Like every write in
 * the API they go through the authority gate: points are an award_points item, a redeem is a redeem_reward item (auto below the owner's limit, else a decision),
 * a promotion is a send_promo item (ask: nothing reaches a customer until the owner approves).
 */
const ctxOf = (who: ApiPrincipal): EngineCtx => ({ db: supabaseAdmin(), ws: who.workspaceId, actor: `api:${who.name}`, locale: "vi" });

const need = async (c: EngineCtx) => {
  const program = await activeProgram(c.db, c.ws);
  if (!program) throw new ApiError(409, "loyalty_off", "Module Khách hàng thân thiết chưa được cài hoặc đang tắt trong workspace này.");
  return program;
};

const view = (m: Awaited<ReturnType<typeof loadMember>>, config: Parameters<typeof tierOf>[0]) =>
  m && { customer_id: m.id, name: m.name, phone: m.phone, email: m.email, tier: tierOf(config, m.tierKey)?.name ?? null, points: m.points, lifetime_spend_vnd: m.lifetimeSpendVnd, visits: m.visits, last_visit_at: m.lastVisitAt };

/** GET /api/v1/loyalty/members?phone=0912345678 (one member) or ?limit=50 (the list, newest first). */
export const listLoyaltyMembers = async (who: ApiPrincipal, phoneRaw: string | null, limit: number) => {
  const c = ctxOf(who);
  const program = await need(c);
  if (phoneRaw) {
    const phone = normalisePhone(phoneRaw);
    if (!phone) throw new ApiError(400, "invalid_request", 'Tham số "phone" không phải số điện thoại Việt Nam.');
    const row = (await c.db.from("loyalty_customers").select("id").eq("workspace_id", c.ws).eq("phone", phone).maybeSingle()).data as { id: string } | null;
    return { members: row ? [view(await loadMember(c.db, c.ws, row.id), program.config)] : [] };
  }
  return { members: (await loadMembers(c.db, c.ws)).slice(0, limit).map((m) => view(m, program.config)) };
};

/** POST /api/v1/loyalty/award { phone, name?, amount_vnd, ref, items?, occurred_at? }: points for a sale the shop made outside NIVO. `ref` is YOUR receipt id: sending it twice gives points once. */
export const awardLoyaltyPoints = async (who: ApiPrincipal, body: Record<string, unknown>) => {
  const c = ctxOf(who);
  const program = await need(c);
  const phone = normalisePhone(field(body, "phone", { required: true, max: 30 }));
  if (!phone) throw new ApiError(400, "invalid_request", 'Trường "phone" không phải số điện thoại Việt Nam.');
  const amount = Math.round(Number(body.amount_vnd));
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "invalid_request", 'Trường "amount_vnd" phải là số tiền lớn hơn 0.');
  const ref = field(body, "ref", { required: true, max: 80 });
  const out = await startAward(c.db, c.ws, program, {
    leadId: null, name: field(body, "name", { max: 120 }) || null, phone, orderId: null, invoiceId: null, amountVnd: amount, items: field(body, "items", { max: 300 }) || null,
    origin: "live", source: "api", occurredAt: field(body, "occurred_at", { max: 40 }) || null,
  }, `pos:${who.keyId.slice(0, 8)}:${ref}`);
  if (!out) throw new ApiError(400, "invalid_request", "Không tạo được khách để cộng điểm.");
  const row = (await c.db.from("loyalty_customers").select("id").eq("workspace_id", c.ws).eq("phone", phone).maybeSingle()).data as { id: string } | null;
  return { status: out.status, customer: view(row ? await loadMember(c.db, c.ws, row.id) : null, program.config) };
};

/** POST /api/v1/loyalty/redeem { phone | customer_id, reward_key, ref? }. */
export const redeemLoyaltyReward = async (who: ApiPrincipal, body: Record<string, unknown>) => {
  const c = ctxOf(who);
  const program = await need(c);
  const phone = normalisePhone(field(body, "phone", { max: 30 }));
  const customerId = field(body, "customer_id", { max: 60 });
  if (!phone && !customerId) throw new ApiError(400, "invalid_request", 'Cần "phone" hoặc "customer_id".');
  const row = (phone
    ? (await c.db.from("loyalty_customers").select("id").eq("workspace_id", c.ws).eq("phone", phone).maybeSingle()).data
    : (await c.db.from("loyalty_customers").select("id").eq("workspace_id", c.ws).eq("id", customerId).maybeSingle()).data) as { id: string } | null;
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy khách này trong chương trình.");
  const m = await loadMember(c.db, c.ws, row.id);
  const key = field(body, "reward_key", { required: true, max: 40 });
  const reward = (await loadRewards(c.db, c.ws, true)).find((r) => r.key === key);
  if (!m || !reward) throw new ApiError(404, "not_found", "Không tìm thấy phần quà này trong danh mục.");
  const block = redeemBlock(program.config, reward, { points: m.points, tierKey: m.tierKey, redeemedBefore: await redeemedCount(c.db, m.id, reward.id) });
  if (block) throw new ApiError(422, "not_redeemable", block);
  const reach = await reachOf(c.db, c.ws, m.id);
  const ref = field(body, "ref", { max: 80 });
  const item = await runWork(c, {
    action: "redeem_reward", subject_type: "lead", subject_id: reach.leadId, lead_id: reach.leadId, origin: "live",
    dedupeKey: `redeem_reward:api:${who.keyId.slice(0, 8)}:${ref || randomUUID()}`, preset: true, noChain: true,
    seed: {
      summary: `Đổi "${reward.name}" cho ${m.name} (${formatPoints(reward.pointsCost)}, trị giá ${formatVndShort(reward.valueVnd)})`, amount_vnd: reward.valueVnd,
      fields: { customer: m.name, customer_id: m.id, reward_id: reward.id, reward: reward.name, amount_vnd: reward.valueVnd, source: `api:${who.name}` },
    },
  });
  const after = await loadMember(c.db, c.ws, m.id);
  return {
    status: item.status, decided_path: item.decided_path, reason: item.reason, work_item_id: item.id, result: item.result?.summary ?? null,
    reward: { key: reward.key, name: reward.name, value_vnd: reward.valueVnd, points_cost: reward.pointsCost }, customer: view(after, program.config),
  };
};

/** POST /api/v1/loyalty/promo { name?, brief, segment: { tiers?, inactive_days?, birthday_this_month?, min_spend_vnd? } }: OpenClaw drafts the message, the owner decides. */
export const createLoyaltyPromo = async (who: ApiPrincipal, body: Record<string, unknown>) => {
  const c = ctxOf(who);
  await need(c);
  const s = (body.segment && typeof body.segment === "object" ? body.segment : {}) as Record<string, unknown>;
  const segment = resolveSegment({ tiers: s.tiers, inactiveDays: s.inactive_days, birthdayThisMonth: s.birthday_this_month, minSpendVnd: s.min_spend_vnd });
  const out = await createCampaign(c, { name: field(body, "name", { max: 100 }), segment, brief: field(body, "brief", { max: 400 }), by: `api:${who.name}` }).catch((e: unknown) => {
    throw new ApiError(422, "no_recipients", e instanceof Error ? e.message : "Không tạo được chiến dịch.");
  });
  return {
    campaign_id: out.campaignId, status: out.status, recipients: out.recipients, work_item_id: out.workItemId,
    draft: { text: out.draft.text, written_by: out.draft.generated ? "openclaw" : "template", ms: out.draft.ms, reason: out.draft.reason },
  };
};
