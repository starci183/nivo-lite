import "server-only";
import { runWork, type EngineCtx } from "./engine";
import { supabaseAdmin } from "./supabase/admin";
import { ensureProgram, expireDue, loadMember, resolveCustomer, type Db, type Program } from "./module-loyalty-core";
import { formatPoints, formatVndShort, pointsFor, tierFor, tierOf } from "./module-loyalty-shared";

/**
 * Earning: points come from money that really came in. `payment.received` (an invoice is paid) is the default trigger, `order.confirmed` the option for shops
 * that give points at the till; the programme's `earn.trigger` picks ONE so a purchase is never counted twice (and the ledger ref `order:<id>` / `invoice:<id>`
 * makes a second attempt harmless anyway). Both come through emitEvent (src/lib/outbound-events.ts); the minute tick (scanPurchases) catches any the event missed.
 * Every purchase is one `award_points` work item, so the owner's rule (auto by default, "assist" mode asks) decides, and the decision is on record.
 */
const ctxOf = (db: Db, ws: string): EngineCtx => ({ db, ws, actor: "Khách hàng thân thiết", locale: "vi" });

/** The programme when loyalty is installed (not paused) and switched on in this workspace; otherwise null. */
export const activeProgram = async (db: Db, ws: string): Promise<Program | null> => {
  const inst = (await db.from("module_installations").select("status").eq("workspace_id", ws).eq("module_key", "loyalty").limit(1)).data as Array<{ status: string }> | null;
  if (!inst?.length || inst[0].status === "paused") return null;
  const program = await ensureProgram(db, ws);
  return program.enabled ? program : null;
};

export type Purchase = {
  leadId: string | null; name: string | null; orderId: string | null; invoiceId: string | null; amountVnd: number; items: string | null;
  origin: "live" | "simulated"; source: "payment" | "order" | "api"; occurredAt?: string | null; phone?: string | null; email?: string | null;
};

export const purchaseRef = (p: Pick<Purchase, "orderId" | "invoiceId">): string | null => (p.orderId ? `order:${p.orderId}` : p.invoiceId ? `invoice:${p.invoiceId}` : null);

/** Open ONE award_points item for a purchase. Returns the item status, or null when there is nobody to give points to. */
export const startAward = async (db: Db, ws: string, program: Program, p: Purchase, refOverride?: string): Promise<{ status: string; ref: string } | null> => {
  const ref = refOverride ?? purchaseRef(p);
  if (!ref || p.amountVnd <= 0) return null;
  const cust = await resolveCustomer(db, ws, { leadId: p.leadId, name: p.name, phone: p.phone, email: p.email });
  if (!cust) return null;
  const member = await loadMember(db, ws, cust.id);
  const calc = pointsFor(program.config, { amountVnd: p.amountVnd, items: p.items, tier: tierOf(program.config, member?.tierKey ?? null) ?? tierFor(program.config, member?.lifetimeSpendVnd ?? 0) });
  const who = member?.name ?? p.name ?? "khách";
  const item = await runWork(ctxOf(db, ws), {
    action: "award_points", subject_type: "lead", subject_id: p.leadId, lead_id: p.leadId, origin: p.origin, dedupeKey: `award_points:${ref}`, preset: true, noChain: true,
    seed: {
      summary: `Cộng ${formatPoints(calc.points)} cho ${who} (${formatVndShort(p.amountVnd)})`,
      fields: { customer: who, customer_id: cust.id, order_id: p.orderId, invoice_id: p.invoiceId, amount_vnd: p.amountVnd, items: p.items, ref, source: p.source, occurred_at: p.occurredAt ?? null },
    },
  });
  return { status: item.status, ref };
};

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** emitEvent hook: payment.received / order.confirmed. Never throws (the caller has already written the sale). */
export const onLoyaltyEvent = async (ws: string, event: string, data: Readonly<Record<string, unknown>>): Promise<void> => {
  if (event !== "payment.received" && event !== "order.confirmed") return;
  try {
    const db = supabaseAdmin();
    const program = await activeProgram(db, ws);
    if (!program) return;
    if ((event === "payment.received") !== (program.config.earn.trigger === "payment")) return;
    const orderId = s(data.order_id);
    const items = orderId ? ((await db.from("orders").select("items").eq("id", orderId).maybeSingle()).data as { items: string } | null)?.items ?? s(data.items) : s(data.items);
    await startAward(db, ws, program, {
      leadId: s(data.lead_id), name: s(data.customer), orderId, invoiceId: s(data.invoice_id), amountVnd: num(data.amount_vnd), items,
      origin: "live", source: event === "payment.received" ? "payment" : "order",
    });
  } catch (e) {
    console.error("loyalty earn failed:", e instanceof Error ? e.message : e);
  }
};

/* ------------------------------------------------------------------ the tick: catch up, then expire */

type InvoiceRow = { id: string; order_id: string | null; lead_id: string | null; amount_vnd: number; paid_at: string | null; origin: "live" | "simulated" };
type OrderRow = { id: string; lead_id: string | null; amount_vnd: number | null; items: string; confirmed_at: string | null; origin: "live" | "simulated" };

/** Purchases of the last 30 days (never before the programme existed) that have no points and no open item: opens their award_points item. Returns how many were opened. */
export const scanPurchases = async (db: Db, ws: string, program: Program, now: Date, limit = 25): Promise<number> => {
  const since = new Date(Math.max(Date.parse(program.createdAt), now.getTime() - 30 * 86_400_000)).toISOString();
  type Cand = Purchase & { ref: string };
  const cands: Array<Cand> = [];
  if (program.config.earn.trigger === "payment") {
    const rows = ((await db.from("invoices").select("id, order_id, lead_id, amount_vnd, paid_at, origin").eq("workspace_id", ws).eq("status", "paid").gte("paid_at", since).order("paid_at", { ascending: false }).limit(60)).data ?? []) as Array<InvoiceRow>;
    const orderIds = rows.map((r) => r.order_id).filter((x): x is string => !!x);
    const items = new Map((orderIds.length ? (((await db.from("orders").select("id, items").in("id", orderIds)).data ?? []) as Array<{ id: string; items: string }>) : []).map((o) => [o.id, o.items]));
    for (const r of rows) {
      const p: Purchase = { leadId: r.lead_id, name: null, orderId: r.order_id, invoiceId: r.id, amountVnd: Number(r.amount_vnd), items: r.order_id ? items.get(r.order_id) ?? null : null, origin: r.origin, source: "payment", occurredAt: r.paid_at };
      const ref = purchaseRef(p);
      if (ref) cands.push({ ...p, ref });
    }
  } else {
    const rows = ((await db.from("orders").select("id, lead_id, amount_vnd, items, confirmed_at, origin").eq("workspace_id", ws).in("status", ["confirmed", "invoiced", "paid"]).gte("confirmed_at", since).order("confirmed_at", { ascending: false }).limit(60)).data ?? []) as Array<OrderRow>;
    for (const r of rows) cands.push({ leadId: r.lead_id, name: null, orderId: r.id, invoiceId: null, amountVnd: Number(r.amount_vnd ?? 0), items: r.items, origin: r.origin, source: "order", occurredAt: r.confirmed_at, ref: `order:${r.id}` });
  }
  if (!cands.length) return 0;
  // Oldest first: a customer's tier (and its multiplier) must grow in the order they actually bought.
  cands.sort((a, b) => Date.parse(a.occurredAt ?? "") - Date.parse(b.occurredAt ?? ""));
  const refs = cands.map((c) => c.ref);
  const [done, open] = await Promise.all([
    db.from("loyalty_ledger").select("ref").eq("workspace_id", ws).in("ref", refs),
    db.from("work_items").select("dedupe_key").eq("workspace_id", ws).in("dedupe_key", refs.map((r) => `award_points:${r}`)),
  ]);
  const skip = new Set([...((done.data ?? []) as Array<{ ref: string }>).map((r) => r.ref), ...((open.data ?? []) as Array<{ dedupe_key: string }>).map((r) => r.dedupe_key.replace(/^award_points:/, ""))]);
  let n = 0;
  for (const c of cands) {
    if (skip.has(c.ref) || n >= limit) continue;
    if (c.amountVnd <= 0 || !c.leadId) continue;
    if ((await startAward(db, ws, program, c)) !== null) n += 1;
  }
  return n;
};

/** Everything loyalty does on the minute tick for ONE workspace that has it on: catch-up earning, points expiry, queued promotion sends. */
export const loyaltyTickFor = async (ws: string, now: Date): Promise<{ awards: number; expired: number }> => {
  const db = supabaseAdmin();
  const program = await activeProgram(db, ws);
  if (!program) return { awards: 0, expired: 0 };
  const awards = await scanPurchases(db, ws, program, now);
  const expired = program.config.expiry.months > 0 ? (await expireDue(db, ws, now)).length : 0;
  const { sendQueuedPromos } = await import("./module-loyalty-promo");
  await sendQueuedPromos(db, ws, program.config, now);
  return { awards, expired };
};

/** Workspaces that have loyalty installed and on. */
export const loyaltyWorkspaces = async (db: Db): Promise<Array<string>> => {
  const rows = ((await db.from("module_installations").select("workspace_id, status").eq("module_key", "loyalty").neq("status", "paused")).data ?? []) as Array<{ workspace_id: string }>;
  return rows.map((r) => r.workspace_id);
};

