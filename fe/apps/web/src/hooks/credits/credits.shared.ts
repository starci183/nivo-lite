import { forecastRunout, packDiscountPct, topupSavings, vndPerCredit } from "@/lib/credits-shared"
import { CREDITS_PER_USD } from "@/lib/usage-shared"
import type { CreditPack, PaymentOrder, Plan, QuotaSnapshot, TopupLot } from "@/modules/db"

/** Plain data of the credits page, and the pure functions that compute it from the rows the page read. */

export type PlanView = {
    readonly code: string
    readonly nameVi: string
    readonly nameEn: string
    /** Monthly credits (null = unlimited). */
    readonly credits: number | null
    readonly price: number
    /** VND per monthly credit. */
    readonly perCredit: number
    readonly seats: number
    readonly isCustom: boolean
}

/** A pack as the credits page shows it. */
export type PackView = {
    readonly code: string
    readonly credits: number
    readonly price: number
    readonly perCredit: number
    readonly discountPct: number
}

/** Why this plan is recommended, from real data. */
export type UpgradeReason =
    | { readonly kind: "topups"; readonly credits: number; readonly saving: number }
    | { readonly kind: "cheaper"; readonly pct: number }
    | { readonly kind: "plain" }

/** One payment order as the credits page lists it. */
export type OrderRow = {
    readonly id: string
    readonly kind: "plan" | "upgrade" | "topup"
    readonly planCode: string
    readonly packCredits: number | null
    readonly amount: number
    readonly createdAt: string
    readonly status: "pending" | "paid" | "expired" | "cancelled"
    readonly code: string
}

/** Everything the credits page needs for one workspace. */
export type CreditsData = {
    /** Owner | manager may buy; staff read only. */
    readonly workspaceId: string
    readonly canBuy: boolean
    readonly paidUntil: string | null
    readonly plan: PlanView | null
    /** This month's credits spent, the allowance with rollover (null = unlimited) and the rollover itself. */
    readonly used: number
    readonly limit: number | null
    readonly carried: number
    /** Top-up credits spendable now and the soonest date some of them expire. */
    readonly topup: number
    readonly topupExpires: string | null
    /** YYYY-MM-DD the allowance runs out this month at the last 7 days' burn, or null. */
    readonly runout: string | null
    readonly packs: ReadonlyArray<PackView>
    readonly plans: ReadonlyArray<PlanView>
    readonly next: { readonly plan: PlanView; readonly reason: UpgradeReason } | null
    /** Shown instead of an upgrade on Max and Enterprise. */
    readonly contact: { readonly plan: PlanView | null; readonly href: string } | null
    readonly orders: ReadonlyArray<OrderRow>
    readonly bank: { readonly account: string; readonly bank: string; readonly holder: string }
}

/** A payment screen's order: created on the server, shown as VietQR in the drawer. */
export type PayOrder = {
    readonly id: string
    readonly code: string
    readonly amount: number
    readonly expiresAt: string
    readonly qrUrl: string
    /** Upgrade only: the unused value of the current plan that was deducted, and the days it is worth. */
    readonly credit?: number
    readonly daysLeft?: number
}

/** How many months of top-ups the saving estimate looks back over. */
const SAVINGS_MONTHS = 2

/** The workspace columns the page reads. */
interface WorkspaceFacts {
    readonly status: string
    readonly plan_code: string | null
    readonly paid_until: string | null
}

/** Everything the credits page is computed from. */
export interface CreditsInput {
    readonly workspaceId: string
    readonly canBuy: boolean
    readonly workspace: WorkspaceFacts
    readonly plans: ReadonlyArray<Plan>
    readonly packs: ReadonlyArray<CreditPack>
    readonly status: QuotaSnapshot | null
    readonly orders: ReadonlyArray<PaymentOrder>
    readonly lots: ReadonlyArray<TopupLot>
    /** The model cost in USD of the last 7 days. */
    readonly last7CostUsd: number
    /** Today, YYYY-MM-DD (product calendar). */
    readonly today: string
    readonly now: Date
    readonly bank: CreditsData["bank"]
    /** Where "contact NIVO" goes. */
    readonly contactHref: string
}

const planViewOf = (plan: Plan): PlanView => ({
    code: plan.code,
    nameVi: plan.name_vi,
    nameEn: plan.name_en,
    credits: plan.ai_credits_per_month,
    price: plan.price_vnd,
    perCredit: plan.ai_credits_per_month ? vndPerCredit(plan.price_vnd, plan.ai_credits_per_month) : 0,
    seats: plan.seats,
    isCustom: plan.is_custom,
})

/** Why `next` is recommended over `plan`: the top-ups it would replace, a lower price per credit, or nothing to claim. */
const reasonOf = (plan: PlanView, next: PlanView, lots: ReadonlyArray<TopupLot>, now: Date): UpgradeReason => {
    const since = new Date(now)
    since.setUTCMonth(since.getUTCMonth() - SAVINGS_MONTHS)
    const recent = lots.filter((lot) => new Date(lot.purchased_at).getTime() >= since.getTime())
    const toppedCredits = recent.reduce((total, lot) => total + lot.credits, 0)
    const toppedVnd = recent.reduce((total, lot) => total + lot.price_vnd, 0)
    const saving = topupSavings({
        toppedCredits,
        toppedVnd,
        months: SAVINGS_MONTHS,
        extraCredits: (next.credits ?? 0) - (plan.credits ?? 0),
        extraVnd: next.price - plan.price,
    })
    if (saving > 0) return { kind: "topups", credits: toppedCredits, saving }
    if (plan.perCredit > 0 && next.perCredit > 0 && next.perCredit < plan.perCredit) {
        return { kind: "cheaper", pct: Math.round((1 - next.perCredit / plan.perCredit) * 100) }
    }
    return { kind: "plain" }
}

const orderRowOf = (order: PaymentOrder): OrderRow => ({
    id: order.id,
    kind: order.kind,
    planCode: order.plan_code,
    packCredits: order.kind === "topup" && typeof order.detail.credits === "number" ? order.detail.credits : null,
    amount: order.amount_vnd,
    createdAt: order.created_at,
    status: order.status,
    code: order.order_code,
})

const topupExpiryOf = (topup: number, lots: ReadonlyArray<TopupLot>, now: Date): string | null =>
    topup > 0
        ? (lots
              .filter((lot) => lot.credits_remaining > 0 && new Date(lot.expires_at).getTime() > now.getTime())
              .map((lot) => lot.expires_at)
              .sort()[0] ?? null)
        : null

/** Computes every figure the credits page shows from the rows the page read. */
export const creditsDataOf = (input: CreditsInput): CreditsData => {
    const views = input.plans.map(planViewOf)
    const selfServe = views.filter((view) => !view.isCustom)
    const plan = views.find((view) => view.code === input.workspace.plan_code) ?? null
    const next =
        plan && !plan.isCustom
            ? (selfServe
                  .filter((candidate) => candidate.price > plan.price && (candidate.credits ?? 0) > (plan.credits ?? 0))
                  .sort((left, right) => left.price - right.price)[0] ?? null)
            : null
    const topup = input.status?.topupBalance ?? 0
    const limit = input.status ? input.status.creditsLimit : (plan?.credits ?? null)
    const used = input.status?.creditsUsed ?? 0
    const base = input.packs[0]
    return {
        workspaceId: input.workspaceId,
        canBuy: input.canBuy,
        paidUntil: input.workspace.paid_until,
        plan,
        used,
        limit,
        carried: input.status?.creditsCarried ?? 0,
        topup,
        topupExpires: topupExpiryOf(topup, input.lots, input.now),
        runout:
            limit === null
                ? null
                : forecastRunout({
                      remaining: limit - used,
                      last7Credits: input.last7CostUsd * CREDITS_PER_USD,
                      today: input.today,
                  }),
        packs: input.packs.map((pack) => ({
            code: pack.code,
            credits: pack.credits,
            price: pack.price_vnd,
            perCredit: vndPerCredit(pack.price_vnd, pack.credits),
            discountPct: base
                ? packDiscountPct(
                      { price: pack.price_vnd, credits: pack.credits },
                      { price: base.price_vnd, credits: base.credits },
                  )
                : 0,
        })),
        plans: selfServe,
        next: plan && next ? { plan: next, reason: reasonOf(plan, next, input.lots, input.now) } : null,
        contact: next ? null : { plan: views.find((view) => view.isCustom) ?? null, href: input.contactHref },
        orders: input.orders.map(orderRowOf),
        bank: input.bank,
    }
}
