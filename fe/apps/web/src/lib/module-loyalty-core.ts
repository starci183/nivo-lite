import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_CONFIG, expirablePoints, normaliseEmail, normalisePhone, pointsFor, redeemBlock, resolveConfig, tierFor, tierOf,
  type LedgerKind, type LedgerRow, type LoyaltyConfig, type LoyaltyTier, type Member, type Reward,
} from "./module-loyalty-shared";

/**
 * Loyalty core (server): the programme, the rewards, ONE customer record per person (linked to leads and conversations through loyalty_customer_links,
 * never changing those tables), and the points ledger. Everything takes a service-role client and a workspace id the CALLER has already checked.
 * Points move only through the SQL function loyalty_post (atomic, idempotent on `ref`); balances are read from the ledger only (view loyalty_balances).
 */
export type Db = SupabaseClient;

const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  if (r.data === null) throw new Error("Không tìm thấy dữ liệu.");
  return r.data;
};

/* ------------------------------------------------------------------ programme */

export type Program = { workspaceId: string; slug: string; name: string; enabled: boolean; config: LoyaltyConfig; createdAt: string };

const slugBase = (name: string): string =>
  name.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "cua-hang";

const toProgram = (r: { workspace_id: string; slug: string; name: string; enabled: boolean; config: unknown; created_at: string }): Program => ({
  workspaceId: r.workspace_id, slug: r.slug, name: r.name, enabled: r.enabled, config: resolveConfig(r.config), createdAt: r.created_at,
});

export const loadProgram = async (db: Db, ws: string): Promise<Program | null> => {
  const { data } = await db.from("loyalty_programs").select("*").eq("workspace_id", ws).maybeSingle();
  return data ? toProgram(data as Parameters<typeof toProgram>[0]) : null;
};

/** The workspace's programme, created on first use with the data defaults and a public slug from the shop's name. */
export const ensureProgram = async (db: Db, ws: string): Promise<Program> => {
  const found = await loadProgram(db, ws);
  if (found) return found;
  const name = ((await db.from("workspaces").select("name").eq("id", ws).maybeSingle()).data as { name: string } | null)?.name ?? "";
  for (let i = 0; i < 5; i++) {
    const slug = `${slugBase(name)}${i === 0 ? "" : `-${randomBytes(2).toString("hex")}`}`;
    const ins = await db.from("loyalty_programs").insert({ workspace_id: ws, slug, name, config: DEFAULT_CONFIG }).select("*").single();
    if (!ins.error) return toProgram(ins.data as Parameters<typeof toProgram>[0]);
    if (ins.error.code === "23505") {
      const again = await loadProgram(db, ws);
      if (again) return again;
      continue;
    }
    throw new Error(ins.error.message);
  }
  throw new Error("Không tạo được chương trình.");
};

export const programBySlug = async (db: Db, slug: string): Promise<Program | null> => {
  const { data } = await db.from("loyalty_programs").select("*").eq("slug", slug).eq("enabled", true).maybeSingle();
  return data ? toProgram(data as Parameters<typeof toProgram>[0]) : null;
};

export const saveProgram = async (db: Db, ws: string, patch: { name?: string; enabled?: boolean; config?: unknown }): Promise<Program> => {
  const cur = await ensureProgram(db, ws);
  const next = {
    ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 80) } : {}),
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.config !== undefined ? { config: resolveConfig(patch.config) } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db.from("loyalty_programs").update(next).eq("workspace_id", cur.workspaceId).select("*").single();
  if (error) throw new Error(error.message);
  return toProgram(data as Parameters<typeof toProgram>[0]);
};

/* ------------------------------------------------------------------ rewards */

type RewardRow = {
  id: string; key: string; name: string; kind: Reward["kind"]; value_vnd: number; percent: number | null; points_cost: number; stock: number | null;
  per_customer_limit: number | null; min_tier_key: string | null; note: string; active: boolean; sort_order: number;
};
const toReward = (r: RewardRow): Reward => ({
  id: r.id, key: r.key, name: r.name, kind: r.kind, valueVnd: Number(r.value_vnd), percent: r.percent, pointsCost: r.points_cost, stock: r.stock,
  perCustomerLimit: r.per_customer_limit, minTierKey: r.min_tier_key, note: r.note, active: r.active, sortOrder: r.sort_order,
});

export const loadRewards = async (db: Db, ws: string, onlyActive = false): Promise<Array<Reward>> => {
  let q = db.from("loyalty_rewards").select("*").eq("workspace_id", ws).order("sort_order").order("points_cost");
  if (onlyActive) q = q.eq("active", true);
  return ((await q).data ?? []).map((r) => toReward(r as RewardRow));
};

export const loadReward = async (db: Db, ws: string, id: string): Promise<Reward | null> => {
  const { data } = await db.from("loyalty_rewards").select("*").eq("workspace_id", ws).eq("id", id).maybeSingle();
  return data ? toReward(data as RewardRow) : null;
};

const keyOf = (name: string): string => slugBase(name).slice(0, 30);

export type RewardEdit = {
  id?: string; name: string; kind: Reward["kind"]; valueVnd: number; percent: number | null; pointsCost: number; stock: number | null;
  perCustomerLimit: number | null; minTierKey: string | null; note: string; active: boolean; key?: string;
};

export const saveReward = async (db: Db, ws: string, e: RewardEdit): Promise<Reward> => {
  const name = e.name.trim().slice(0, 80);
  if (!name) throw new Error("Hãy đặt tên cho phần quà.");
  const pointsCost = Math.round(e.pointsCost);
  if (!Number.isFinite(pointsCost) || pointsCost < 1) throw new Error("Số điểm đổi phải từ 1 điểm trở lên.");
  const row = {
    name, kind: e.kind, value_vnd: Math.max(0, Math.round(e.valueVnd) || 0), percent: e.kind === "percent" ? Math.min(100, Math.max(1, Math.round(e.percent ?? 10))) : null,
    points_cost: pointsCost, stock: e.stock === null ? null : Math.max(0, Math.round(e.stock)), per_customer_limit: e.perCustomerLimit === null ? null : Math.max(1, Math.round(e.perCustomerLimit)),
    min_tier_key: e.minTierKey || null, note: e.note.trim().slice(0, 200), active: e.active,
  };
  if (e.id) {
    const { data, error } = await db.from("loyalty_rewards").update(row).eq("workspace_id", ws).eq("id", e.id).select("*").single();
    if (error) throw new Error(error.message);
    return toReward(data as RewardRow);
  }
  const base = e.key?.trim() || keyOf(name);
  for (let i = 0; i < 4; i++) {
    const ins = await db.from("loyalty_rewards").insert({ ...row, workspace_id: ws, key: i === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`, sort_order: 100 + i }).select("*").single();
    if (!ins.error) return toReward(ins.data as RewardRow);
    if (ins.error.code !== "23505") throw new Error(ins.error.message);
  }
  throw new Error("Không lưu được phần quà.");
};

export const deleteReward = async (db: Db, ws: string, id: string): Promise<void> => {
  // A reward already redeemed stays in the ledger (reward_id is set null by the foreign key); the shop usually just pauses it.
  const { error } = await db.from("loyalty_rewards").delete().eq("workspace_id", ws).eq("id", id);
  if (error) throw new Error(error.message);
};

/* ------------------------------------------------------------------ customers */

type CustomerRow = {
  id: string; name: string; phone: string | null; email: string | null; birthday: string | null; tier_key: string | null; tier_since: string | null;
  joined_at: string; note: string;
};
type BalanceRow = { customer_id: string; points: number; lifetime_spend_vnd: number; visits: number; last_visit_at: string | null };

const toMember = (c: CustomerRow, b: BalanceRow | undefined): Member => ({
  id: c.id, name: c.name, phone: c.phone, email: c.email, birthday: c.birthday, tierKey: c.tier_key, points: b?.points ?? 0,
  lifetimeSpendVnd: Number(b?.lifetime_spend_vnd ?? 0), visits: b?.visits ?? 0, lastVisitAt: b?.last_visit_at ?? null, joinedAt: c.joined_at, note: c.note,
});

export const loadMembers = async (db: Db, ws: string): Promise<Array<Member>> => {
  const [cs, bs] = await Promise.all([
    db.from("loyalty_customers").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(2000),
    db.from("loyalty_balances").select("customer_id, points, lifetime_spend_vnd, visits, last_visit_at").eq("workspace_id", ws).limit(2000),
  ]);
  const byId = new Map(((bs.data ?? []) as Array<BalanceRow>).map((b) => [b.customer_id, b]));
  return ((cs.data ?? []) as Array<CustomerRow>).map((c) => toMember(c, byId.get(c.id)));
};

export const loadMember = async (db: Db, ws: string, id: string): Promise<Member | null> => {
  const c = (await db.from("loyalty_customers").select("*").eq("workspace_id", ws).eq("id", id).maybeSingle()).data as CustomerRow | null;
  if (!c) return null;
  const b = (await db.from("loyalty_balances").select("customer_id, points, lifetime_spend_vnd, visits, last_visit_at").eq("customer_id", id).maybeSingle()).data as BalanceRow | null;
  return toMember(c, b ?? undefined);
};

type LedgerDb = {
  id: string; customer_id: string; kind: LedgerKind; points: number; amount_vnd: number | null; order_id: string | null; ref: string; by_name: string;
  evidence: string | null; reward_id: string | null; work_item_id: string | null; expires_at: string | null; occurred_at: string;
};
const toLedger = (r: LedgerDb): LedgerRow => ({
  id: r.id, customerId: r.customer_id, kind: r.kind, points: r.points, amountVnd: r.amount_vnd === null ? null : Number(r.amount_vnd), orderId: r.order_id, ref: r.ref,
  by: r.by_name, evidence: r.evidence, rewardId: r.reward_id, workItemId: r.work_item_id, expiresAt: r.expires_at, occurredAt: r.occurred_at,
});

export const loadLedger = async (db: Db, ws: string, customerId: string, limit = 200): Promise<Array<LedgerRow>> =>
  ((await db.from("loyalty_ledger").select("*").eq("workspace_id", ws).eq("customer_id", customerId).order("occurred_at", { ascending: false }).limit(limit)).data ?? []).map((r) => toLedger(r as LedgerDb));

export type CustomerHint = {
  leadId?: string | null; conversationId?: string | null; channelRef?: string | null;
  phone?: string | null; email?: string | null; name?: string | null; birthday?: string | null;
};

const addLink = async (db: Db, ws: string, customerId: string, kind: "lead" | "conversation" | "channel", ref: string | null | undefined): Promise<void> => {
  if (!ref) return;
  // Re-point a link that belonged to a duplicate: the phone number is the identity, the links follow it.
  await db.from("loyalty_customer_links").upsert({ workspace_id: ws, customer_id: customerId, kind, ref }, { onConflict: "workspace_id,kind,ref" });
};

/** Link the lead's real conversations (and their channel accounts) to the customer, so the chat can recognise them. */
const linkConversationsOfLead = async (db: Db, ws: string, customerId: string, leadId: string): Promise<void> => {
  const convs = ((await db.from("agent_conversations").select("id, channel, external_id").eq("workspace_id", ws).eq("lead_id", leadId).eq("kind", "customer")).data ?? []) as Array<{ id: string; channel: string | null; external_id: string | null }>;
  for (const c of convs) {
    await addLink(db, ws, customerId, "conversation", c.id);
    if (c.channel && c.external_id) await addLink(db, ws, customerId, "channel", `${c.channel}:${c.external_id.split(":")[0]}`);
  }
};

/**
 * The customer a person is: by normalised phone first, then email, then the lead / conversation / channel links. A new customer is created when none matches
 * and there is something to call them by. Missing phone or email are filled from the hint; the links are always kept up to date.
 */
export const resolveCustomer = async (db: Db, ws: string, h: CustomerHint): Promise<{ id: string; created: boolean } | null> => {
  let phone = normalisePhone(h.phone);
  let email = normaliseEmail(h.email);
  let name = (h.name ?? "").trim();
  if (h.leadId && (!phone || !email || !name)) {
    const lead = (await db.from("leads").select("contact_name, phone, email").eq("workspace_id", ws).eq("id", h.leadId).maybeSingle()).data as { contact_name: string; phone: string | null; email: string | null } | null;
    if (lead) {
      phone = phone ?? normalisePhone(lead.phone);
      email = email ?? normaliseEmail(lead.email);
      name = name || lead.contact_name;
    }
  }
  let id: string | null = null;
  if (phone) id = ((await db.from("loyalty_customers").select("id").eq("workspace_id", ws).eq("phone", phone).maybeSingle()).data as { id: string } | null)?.id ?? null;
  if (!id && email) id = ((await db.from("loyalty_customers").select("id").eq("workspace_id", ws).eq("email", email).maybeSingle()).data as { id: string } | null)?.id ?? null;
  if (!id) {
    for (const [kind, ref] of [["lead", h.leadId], ["conversation", h.conversationId], ["channel", h.channelRef]] as const) {
      if (!ref) continue;
      const l = (await db.from("loyalty_customer_links").select("customer_id").eq("workspace_id", ws).eq("kind", kind).eq("ref", ref).maybeSingle()).data as { customer_id: string } | null;
      if (l) { id = l.customer_id; break; }
    }
  }
  let created = false;
  if (!id) {
    if (!name && !phone && !email) return null;
    const ins = await db.from("loyalty_customers").insert({ workspace_id: ws, name: name || (phone ? `Khách ${phone.slice(-4)}` : email ?? "Khách"), phone, email, birthday: h.birthday || null }).select("id").single();
    if (ins.error) {
      if (ins.error.code === "23505") return resolveCustomer(db, ws, h); // a concurrent request created the same person
      throw new Error(ins.error.message);
    }
    id = (ins.data as { id: string }).id;
    created = true;
  } else {
    const cur = (await db.from("loyalty_customers").select("name, phone, email, birthday").eq("id", id).maybeSingle()).data as { name: string; phone: string | null; email: string | null; birthday: string | null } | null;
    const patch: Record<string, unknown> = {};
    if (cur && !cur.phone && phone) patch.phone = phone;
    if (cur && !cur.email && email) patch.email = email;
    if (cur && !cur.birthday && h.birthday) patch.birthday = h.birthday;
    if (Object.keys(patch).length) await db.from("loyalty_customers").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  }
  await Promise.all([addLink(db, ws, id, "lead", h.leadId), addLink(db, ws, id, "conversation", h.conversationId), addLink(db, ws, id, "channel", h.channelRef)]);
  if (h.leadId) await linkConversationsOfLead(db, ws, id, h.leadId);
  return { id, created };
};

/** Every lead with a contact becomes (or joins) a customer; their conversations are linked. Idempotent; returns how many customers exist after it. */
export const syncCustomersFromLeads = async (db: Db, ws: string): Promise<{ created: number; linked: number }> => {
  const leads = ((await db.from("leads").select("id, contact_name, phone, email, stage").eq("workspace_id", ws).or("phone.not.is.null,email.not.is.null,stage.eq.won").order("created_at").limit(2000)).data ?? []) as Array<{ id: string; contact_name: string; phone: string | null; email: string | null }>;
  let created = 0;
  let linked = 0;
  for (const l of leads) {
    const r = await resolveCustomer(db, ws, { leadId: l.id, phone: l.phone, email: l.email, name: l.contact_name });
    if (!r) continue;
    linked += 1;
    if (r.created) created += 1;
  }
  return { created, linked };
};

export const updateCustomer = async (db: Db, ws: string, id: string, p: { name?: string; birthday?: string | null; note?: string }): Promise<void> => {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.name !== undefined && p.name.trim()) patch.name = p.name.trim().slice(0, 120);
  if (p.birthday !== undefined) patch.birthday = p.birthday && /^\d{4}-\d{2}-\d{2}$/.test(p.birthday) ? p.birthday : null;
  if (p.note !== undefined) patch.note = p.note.trim().slice(0, 500);
  const { error } = await db.from("loyalty_customers").update(patch).eq("workspace_id", ws).eq("id", id);
  if (error) throw new Error(error.message);
};

/** The customer's lead (for gate items and the chat) and where a message to them leaves: the newest real conversation, preferring a pushed channel. */
export type Reach = { leadId: string | null; conversationId: string | null; channel: string | null; handledBy: string | null };
export const reachOf = async (db: Db, ws: string, customerId: string): Promise<Reach> => {
  const links = ((await db.from("loyalty_customer_links").select("kind, ref").eq("workspace_id", ws).eq("customer_id", customerId)).data ?? []) as Array<{ kind: string; ref: string }>;
  const leadIds = links.filter((l) => l.kind === "lead").map((l) => l.ref);
  const convIds = links.filter((l) => l.kind === "conversation").map((l) => l.ref);
  let convs: Array<{ id: string; channel: string | null; handled_by: string | null; lead_id: string | null; created_at: string }> = [];
  if (convIds.length || leadIds.length) {
    const filters = [convIds.length ? `id.in.(${convIds.join(",")})` : "", leadIds.length ? `lead_id.in.(${leadIds.join(",")})` : ""].filter(Boolean).join(",");
    convs = ((await db.from("agent_conversations").select("id, channel, handled_by, lead_id, created_at").eq("workspace_id", ws).eq("kind", "customer").or(filters).order("created_at", { ascending: false }).limit(10)).data ?? []) as typeof convs;
  }
  const pushed = convs.find((c) => c.channel === "telegram" || c.channel === "zalo") ?? convs[0] ?? null;
  return { leadId: leadIds[0] ?? pushed?.lead_id ?? null, conversationId: pushed?.id ?? null, channel: pushed?.channel ?? null, handledBy: pushed?.handled_by ?? null };
};

/* ------------------------------------------------------------------ the ledger */

export type PostArgs = {
  ws: string; customerId: string; kind: LedgerKind; points: number; ref: string; by: string; amountVnd?: number | null; orderId?: string | null;
  invoiceId?: string | null; rewardId?: string | null; workItemId?: string | null; evidence?: string | null; expiresAt?: string | null; occurredAt?: string | null;
};

/** Move points. Null = this `ref` was already posted (nothing changed). Throws `Error("insufficient_points" | "out_of_stock" | "limit_reached" | ...)` from the SQL function. */
export const postLedger = async (db: Db, a: PostArgs): Promise<string | null> => {
  const { data, error } = await db.rpc("loyalty_post", {
    p_workspace: a.ws, p_customer: a.customerId, p_kind: a.kind, p_points: a.points, p_ref: a.ref, p_by: a.by, p_amount_vnd: a.amountVnd ?? null,
    p_order_id: a.orderId ?? null, p_invoice_id: a.invoiceId ?? null, p_reward_id: a.rewardId ?? null, p_work_item_id: a.workItemId ?? null,
    p_evidence: a.evidence ?? null, p_expires_at: a.expiresAt ?? null, p_occurred_at: a.occurredAt ?? null,
  });
  if (error) throw new Error((error.message.match(/insufficient_points|out_of_stock|limit_reached|reward_inactive|reward_not_found|customer_not_found/)?.[0] ?? error.message));
  return (data as string | null) ?? null;
};

export const expiryDate = (config: LoyaltyConfig, from: Date): string | null => {
  if (config.expiry.months <= 0) return null;
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + config.expiry.months);
  return d.toISOString();
};

export type TierUp = { customerId: string; from: LoyaltyTier | null; to: LoyaltyTier };

/** Bring the customer's tier up to what their lifetime spend earns. Tiers only go up. Returns the upgrade (the caller announces it), or null. */
export const refreshTier = async (db: Db, ws: string, customerId: string, config: LoyaltyConfig): Promise<TierUp | null> => {
  const m = await loadMember(db, ws, customerId);
  if (!m) return null;
  const earned = tierFor(config, m.lifetimeSpendVnd);
  if (!earned) return null;
  const heldIdx = config.tiers.findIndex((t) => t.key === m.tierKey);
  const earnedIdx = config.tiers.findIndex((t) => t.key === earned.key);
  if (heldIdx >= earnedIdx && m.tierKey) return null;
  let q = db.from("loyalty_customers").update({ tier_key: earned.key, tier_since: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", customerId).eq("workspace_id", ws);
  q = m.tierKey === null ? q.is("tier_key", null) : q.eq("tier_key", m.tierKey);
  const { data } = await q.select("id");
  // Someone else moved the tier first, or a new customer simply started at the base tier: nothing to celebrate.
  if (!data?.length || (heldIdx < 0 && earnedIdx === 0)) return null;
  return { customerId, from: tierOf(config, m.tierKey), to: earned };
};

export type EarnResult = { points: number; note: string; posted: boolean; tierUp: TierUp | null };

/** Earn points for one purchase (idempotent on `ref`), then refresh the tier. */
export const earnForPurchase = async (
  db: Db, ws: string, config: LoyaltyConfig,
  p: { customerId: string; amountVnd: number; items?: string | null; ref: string; by: string; orderId?: string | null; invoiceId?: string | null; workItemId?: string | null; occurredAt?: string | null },
): Promise<EarnResult> => {
  const m = await loadMember(db, ws, p.customerId);
  if (!m) throw new Error("customer_not_found");
  const calc = pointsFor(config, { amountVnd: p.amountVnd, items: p.items, tier: tierOf(config, m.tierKey) ?? tierFor(config, m.lifetimeSpendVnd) });
  if (calc.points <= 0) return { points: 0, note: calc.note, posted: false, tierUp: null };
  const when = p.occurredAt ? new Date(p.occurredAt) : new Date();
  const id = await postLedger(db, {
    ws, customerId: p.customerId, kind: "earn", points: calc.points, ref: p.ref, by: p.by, amountVnd: Math.round(p.amountVnd), orderId: p.orderId, invoiceId: p.invoiceId,
    workItemId: p.workItemId, evidence: calc.note, expiresAt: expiryDate(config, when), occurredAt: when.toISOString(),
  });
  const tierUp = id ? await refreshTier(db, ws, p.customerId, config) : null;
  return { points: calc.points, note: calc.note, posted: id !== null, tierUp };
};

/** Redeem a reward: validated against the live balance, stock, limit and tier, then posted atomically. */
export const redeemRewardNow = async (
  db: Db, ws: string, config: LoyaltyConfig, p: { customerId: string; reward: Reward; ref: string; by: string; workItemId?: string | null; evidence?: string | null },
): Promise<{ code: string; posted: boolean }> => {
  const m = await loadMember(db, ws, p.customerId);
  if (!m) throw new Error("customer_not_found");
  const redeemedBefore = (await db.from("loyalty_ledger").select("id", { count: "exact", head: true }).eq("customer_id", p.customerId).eq("reward_id", p.reward.id).eq("kind", "redeem")).count ?? 0;
  const block = redeemBlock(config, p.reward, { points: m.points, tierKey: m.tierKey, redeemedBefore });
  if (block) throw new Error(block);
  const code = `QT-${p.ref.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase().padStart(6, "0")}`;
  const id = await postLedger(db, {
    ws, customerId: p.customerId, kind: "redeem", points: -p.reward.pointsCost, ref: p.ref, by: p.by, amountVnd: p.reward.valueVnd, rewardId: p.reward.id,
    workItemId: p.workItemId, evidence: p.evidence ?? `Đổi "${p.reward.name}" (mã ${code})`,
  });
  return { code, posted: id !== null };
};

export const adjustPoints = async (db: Db, ws: string, p: { customerId: string; points: number; reason: string; by: string; ref: string; workItemId?: string | null }): Promise<boolean> => {
  const pts = Math.round(p.points);
  if (!pts) throw new Error("Số điểm điều chỉnh phải khác 0.");
  if (!p.reason.trim()) throw new Error("Hãy ghi lý do điều chỉnh.");
  return (await postLedger(db, { ws, customerId: p.customerId, kind: "adjust", points: pts, ref: p.ref, by: p.by, evidence: p.reason.trim().slice(0, 300), workItemId: p.workItemId })) !== null;
};

/** Expire points that passed their date. One `expire` row per customer per day; FIFO-equivalent (see expirablePoints). Returns the customers affected. */
export const expireDue = async (db: Db, ws: string, now = new Date()): Promise<Array<{ customerId: string; points: number }>> => {
  const due = ((await db.from("loyalty_ledger").select("customer_id").eq("workspace_id", ws).eq("kind", "earn").lte("expires_at", now.toISOString())).data ?? []) as Array<{ customer_id: string }>;
  const ids = [...new Set(due.map((d) => d.customer_id))];
  const out: Array<{ customerId: string; points: number }> = [];
  const day = now.toISOString().slice(0, 10);
  for (const id of ids) {
    const rows = (await loadLedger(db, ws, id, 2000));
    const n = expirablePoints(rows, now);
    if (n <= 0) continue;
    const posted = await postLedger(db, { ws, customerId: id, kind: "expire", points: -n, ref: `expire:${id}:${day}`, by: "NIVO", evidence: "Điểm hết hạn theo chính sách của chương trình." }).catch(() => null);
    if (posted) out.push({ customerId: id, points: n });
  }
  return out;
};

/* ------------------------------------------------------------------ small readers */

export const redeemedCount = async (db: Db, customerId: string, rewardId: string): Promise<number> =>
  (await db.from("loyalty_ledger").select("id", { count: "exact", head: true }).eq("customer_id", customerId).eq("reward_id", rewardId).eq("kind", "redeem")).count ?? 0;

export const shopNameOf = async (db: Db, ws: string): Promise<string> =>
  ((await db.from("workspaces").select("name").eq("id", ws).maybeSingle()).data as { name: string } | null)?.name ?? "cửa hàng";

export { must as mustRow };
