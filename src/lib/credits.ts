import "server-only";
import { createPaymentOrder, getPlan, type PaymentOrder } from "./billing";
import { prorateUpgrade } from "./credits-shared";
import { supabaseAdmin } from "./supabase/admin";

/** A top-up pack as sold: server data (`credit_packs`), never taken from the browser. */
export type CreditPack = { readonly code: string; readonly credits: number; readonly price_vnd: number; readonly sort: number };

/** Why an order was refused; the action turns the code into a sentence. */
export type CreditsErrorCode = "pack" | "workspace" | "plan" | "notUpgrade" | "renewFirst" | "zero";
export class CreditsError extends Error {
  constructor(readonly code: CreditsErrorCode) {
    super(code);
    this.name = "CreditsError";
  }
}

export const listCreditPacks = async (): Promise<Array<CreditPack>> => {
  const { data } = await supabaseAdmin().from("credit_packs").select("code, credits, price_vnd, sort").eq("active", true).order("sort");
  return ((data ?? []) as Array<{ code: string; credits: number | string; price_vnd: number | string; sort: number }>).map((p) => ({ ...p, credits: Number(p.credits), price_vnd: Number(p.price_vnd) }));
};

type WorkspaceBilling = { status: string; plan_code: string | null; paid_until: string | null };
const readWorkspace = async (workspaceId: string): Promise<WorkspaceBilling> => {
  const { data } = await supabaseAdmin().from("workspaces").select("status, plan_code, paid_until").eq("id", workspaceId).maybeSingle<WorkspaceBilling>();
  if (!data) throw new CreditsError("workspace");
  return data;
};

/** The pending, unexpired order that already asks for exactly this (same kind, target and amount), so a double click shows one QR. */
const openOrder = async (workspaceId: string, kind: "upgrade" | "topup", match: { pack_code?: string; plan_code?: string }, amount: number): Promise<PaymentOrder | null> => {
  let q = supabaseAdmin().from("payment_orders").select("*").eq("workspace_id", workspaceId).eq("kind", kind).eq("status", "pending").eq("amount_vnd", amount).gt("expires_at", new Date().toISOString());
  if (match.pack_code) q = q.eq("pack_code", match.pack_code);
  if (match.plan_code) q = q.eq("plan_code", match.plan_code);
  const { data } = await q.order("created_at", { ascending: false }).limit(1);
  return ((data ?? [])[0] as PaymentOrder | undefined) ?? null;
};

/**
 * A pending top-up order for one pack (caller verified owner | manager of the workspace). Price and size come from `credit_packs`
 * now; the credits are frozen on the order (`detail.credits`) so the webhook fulfils what was shown even if the catalogue changes.
 */
export const createTopupOrder = async (workspaceId: string, userId: string, packCode: string): Promise<PaymentOrder> => {
  const pack = (await listCreditPacks()).find((p) => p.code === packCode);
  if (!pack) throw new CreditsError("pack");
  const ws = await readWorkspace(workspaceId);
  if ((ws.status !== "active" && ws.status !== "past_due") || !ws.plan_code) throw new CreditsError("workspace");
  const plan = await getPlan(ws.plan_code);
  if (!plan) throw new CreditsError("plan");
  const existing = await openOrder(workspaceId, "topup", { pack_code: pack.code }, pack.price_vnd);
  if (existing) return existing;
  return createPaymentOrder(workspaceId, userId, plan, { kind: "topup", packCode: pack.code, amountVnd: pack.price_vnd, detail: { credits: pack.credits } });
};

/** What an upgrade costs a workspace right now (server figures; the order freezes them). */
export type UpgradeQuote = { readonly amount: number; readonly credit: number; readonly daysLeft: number; readonly fromCode: string };

/**
 * A pending upgrade order to a higher self-serve plan (caller verified owner | manager). The workspace must be active and inside
 * its paid period (otherwise it renews first); the amount is the target price minus the unused value of the current plan,
 * see `prorateUpgrade`. Paying switches plan_code at once and keeps paid_until (settle_payment_order).
 */
export const createUpgradeOrder = async (workspaceId: string, userId: string, targetCode: string): Promise<{ order: PaymentOrder; quote: UpgradeQuote }> => {
  const ws = await readWorkspace(workspaceId);
  if (ws.status !== "active" || !ws.plan_code) throw new CreditsError("workspace");
  const [current, target] = await Promise.all([getPlan(ws.plan_code), getPlan(targetCode)]);
  if (!current || !target || current.is_custom || target.is_custom) throw new CreditsError("notUpgrade");
  if (target.sort <= current.sort || target.price_vnd <= current.price_vnd) throw new CreditsError("notUpgrade");
  if (!ws.paid_until || new Date(ws.paid_until).getTime() <= Date.now()) throw new CreditsError("renewFirst");
  const q = prorateUpgrade({ currentPrice: Number(current.price_vnd), targetPrice: Number(target.price_vnd), paidUntil: ws.paid_until });
  if (q.amount <= 0) throw new CreditsError("zero"); // nothing to transfer: NIVO switches it by hand
  const quote: UpgradeQuote = { amount: q.amount, credit: q.credit, daysLeft: q.daysLeft, fromCode: current.code };
  const existing = await openOrder(workspaceId, "upgrade", { plan_code: target.code }, q.amount);
  if (existing) return { order: existing, quote };
  const order = await createPaymentOrder(workspaceId, userId, target, {
    kind: "upgrade", amountVnd: q.amount,
    detail: { from: current.code, to: target.code, fromPrice: Number(current.price_vnd), toPrice: Number(target.price_vnd), credit: q.credit, daysLeft: q.daysLeft, paidUntil: ws.paid_until },
  });
  return { order, quote };
};
