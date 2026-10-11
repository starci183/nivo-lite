import "server-only";
import { listPlans, type Plan } from "@/lib/billing";
import { listCreditPacks } from "@/lib/credits";
import { forecastRunout, packDiscountPct, topupSavings, vndPerCredit } from "@/lib/credits-shared";
import { TIME_ZONE } from "@/i18n/core";
import { isManagerRole } from "@/lib/members-shared";
import { getSession } from "@/lib/session";
import { bankAccount } from "@/lib/sepay";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { quotaStatus } from "@/lib/usage";
import { CREDITS_PER_USD } from "@/lib/usage-shared";
import type { CreditsData, OrderRow, PlanView, UpgradeReason } from "./types";

const planView = (p: Plan): PlanView => ({
  code: p.code, nameVi: p.name_vi, nameEn: p.name_en, credits: p.ai_credits_per_month === null ? null : Number(p.ai_credits_per_month),
  price: Number(p.price_vnd), perCredit: p.ai_credits_per_month ? vndPerCredit(Number(p.price_vnd), Number(p.ai_credits_per_month)) : 0, seats: p.seats, isCustom: p.is_custom,
});

const addDays = (day: string, n: number): string => new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

/** Where "Liên hệ NIVO" goes: NIVO_CONTACT_URL (a mailto: or a page) when set, else the public site. */
const contactHref = (): string => process.env.NIVO_CONTACT_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://nivo.vn";

/** Everything the page needs for the current workspace. Any member may read it; only owner | manager get `canBuy`. */
export const loadCredits = async (): Promise<CreditsData & { readonly workspaceStatus: string }> => {
  const session = await getSession();
  const wsId = session.workspace.id;
  const db = await supabaseServer();
  const admin = supabaseAdmin();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setUTCMonth(twoMonthsAgo.getUTCMonth() - 2);

  // Independent reads, one wave. The service-role reads (usage, lots) run only for a member of this workspace: getSession proved it.
  const [{ data: ws }, plans, packs, status, orders, lots, daily] = await Promise.all([
    db.from("workspaces").select("status, plan_code, paid_until").eq("id", wsId).single<{ status: string; plan_code: string | null; paid_until: string | null }>(),
    listPlans(),
    listCreditPacks(),
    quotaStatus(wsId),
    db.from("payment_orders").select("id, kind, plan_code, pack_code, detail, amount_vnd, created_at, status, order_code").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(50),
    admin.from("credit_topups").select("credits, price_vnd, purchased_at, expires_at, credits_remaining").eq("workspace_id", wsId).order("purchased_at", { ascending: false }).limit(200),
    admin.from("ai_usage_daily").select("cost_usd").eq("workspace_id", wsId).neq("kind", "guide").gte("day", addDays(today, -6)),
  ]);

  const views = plans.map(planView);
  const selfServe = views.filter((p) => !p.isCustom);
  const plan = views.find((p) => p.code === ws?.plan_code) ?? null;
  const next = plan && !plan.isCustom ? (selfServe.filter((p) => p.price > plan.price && (p.credits ?? 0) > (plan.credits ?? 0)).sort((a, b) => a.price - b.price)[0] ?? null) : null;

  const lotRows = (lots.data ?? []) as Array<{ credits: number | string; price_vnd: number | string; purchased_at: string; expires_at: string; credits_remaining: number | string }>;
  const recent = lotRows.filter((l) => new Date(l.purchased_at).getTime() >= twoMonthsAgo.getTime());
  const toppedCredits = recent.reduce((n, l) => n + Number(l.credits), 0);
  const toppedVnd = recent.reduce((n, l) => n + Number(l.price_vnd), 0);

  let reason: UpgradeReason = { kind: "plain" };
  if (plan && next) {
    const saving = topupSavings({ toppedCredits, toppedVnd, months: 2, extraCredits: (next.credits ?? 0) - (plan.credits ?? 0), extraVnd: next.price - plan.price });
    if (saving > 0) reason = { kind: "topups", credits: toppedCredits, saving };
    else if (plan.perCredit > 0 && next.perCredit > 0 && next.perCredit < plan.perCredit) reason = { kind: "cheaper", pct: Math.round((1 - next.perCredit / plan.perCredit) * 100) };
  }

  const topup = status?.topupBalance ?? 0;
  const now = Date.now();
  const topupExpires = topup > 0
    ? (lotRows.filter((l) => Number(l.credits_remaining) > 0 && new Date(l.expires_at).getTime() > now).map((l) => l.expires_at).sort()[0] ?? null)
    : null;

  const limit = status ? status.creditsLimit : plan?.credits ?? null;
  const used = status?.creditsUsed ?? 0;
  const last7Credits = ((daily.data ?? []) as Array<{ cost_usd: number | string }>).reduce((n, r) => n + Number(r.cost_usd), 0) * CREDITS_PER_USD;
  const runout = limit === null ? null : forecastRunout({ remaining: limit - used, last7Credits, today });

  const base = packs[0];
  const packViews = packs.map((p) => ({
    code: p.code, credits: p.credits, price: p.price_vnd, perCredit: vndPerCredit(p.price_vnd, p.credits),
    discountPct: base ? packDiscountPct({ price: p.price_vnd, credits: p.credits }, { price: base.price_vnd, credits: base.credits }) : 0,
  }));

  type OrderDb = { id: string; kind: OrderRow["kind"]; plan_code: string; detail: { credits?: number } | null; amount_vnd: number | string; created_at: string; status: OrderRow["status"]; order_code: string };
  const orderRows: Array<OrderRow> = ((orders.data ?? []) as Array<OrderDb>).map((o) => ({
    id: o.id, kind: o.kind, planCode: o.plan_code, packCredits: o.kind === "topup" && o.detail?.credits ? Number(o.detail.credits) : null,
    amount: Number(o.amount_vnd), createdAt: o.created_at, status: o.status, code: o.order_code,
  }));

  return {
    canBuy: isManagerRole(session.member.role),
    paidUntil: ws?.paid_until ?? null,
    workspaceStatus: ws?.status ?? "active",
    plan, used, limit, carried: status?.creditsCarried ?? 0, topup, topupExpires, runout,
    packs: packViews,
    plans: selfServe,
    next: plan && next ? { plan: next, reason } : null,
    contact: next ? null : { plan: views.find((p) => p.isCustom) ?? null, href: contactHref() },
    orders: orderRows,
    bank: bankAccount(),
  };
};
