import type { BankAccountOptions, Plan, WorkspaceBilling } from "@modules/domain/billing"
import type { PaymentOrder } from "@modules/domain/payment-orders"
import { CREDITS_PER_USD } from "@modules/domain/usage"
import type { QuotaLookup } from "@modules/domain/usage"
import type {
    CreditPack,
    CreditsOverview,
    NextPlan,
    OrderLine,
    PackView,
    PlanView,
    TopupLot,
    UpgradeReason,
} from "./credits.contracts"
import { forecastRunout, packDiscountPct, topupSavings, vndPerCredit } from "./runway.policy"

/** How many months of top-ups the saving estimate looks back over. */
const SAVINGS_MONTHS = 2

/** Everything the overview is computed from. */
export interface OverviewInput {
    /** Whether the caller may buy. */
    readonly canBuy: boolean
    /** The billing columns of the workspace. */
    readonly workspace: WorkspaceBilling
    /** The active plans in display order. */
    readonly plans: ReadonlyArray<Plan>
    /** The packs on sale in display order. */
    readonly packs: ReadonlyArray<CreditPack>
    /** The allowance status, or null when it cannot be read. */
    readonly status: QuotaLookup
    /** The latest payment orders. */
    readonly orders: ReadonlyArray<PaymentOrder>
    /** The top-up lots of the workspace. */
    readonly lots: ReadonlyArray<TopupLot>
    /** The model cost in USD of the last 7 days. */
    readonly last7CostUsd: number
    /** Today, YYYY-MM-DD (Vietnam calendar). */
    readonly today: string
    /** The current instant. */
    readonly now: Date
    /** The bank account customers pay into. */
    readonly bank: BankAccountOptions
}

const planViewOf = (plan: Plan): PlanView => ({
    code: plan.code,
    nameVi: plan.nameVi,
    nameEn: plan.nameEn,
    credits: plan.aiCreditsPerMonth,
    price: plan.priceVnd,
    perCredit: plan.aiCreditsPerMonth === null ? 0 : vndPerCredit(plan.priceVnd, plan.aiCreditsPerMonth),
    seats: plan.seats,
    isCustom: plan.isCustom,
})

const orderLineOf = (order: PaymentOrder): OrderLine => ({
    id: order.id,
    kind: order.kind,
    planCode: order.planCode,
    packCredits: order.kind === "topup" && typeof order.detail.credits === "number" ? order.detail.credits : null,
    amount: order.amountVnd,
    createdAt: order.createdAt,
    status: order.status,
    code: order.orderCode,
})

/** Why `next` is recommended over `plan`: the top-ups it would replace, a lower price per credit, or nothing to claim. */
const reasonOf = (plan: PlanView, next: PlanView, lots: ReadonlyArray<TopupLot>, now: Date): UpgradeReason => {
    const since = new Date(now)
    since.setUTCMonth(since.getUTCMonth() - SAVINGS_MONTHS)
    const recent = lots.filter((lot) => new Date(lot.purchasedAt).getTime() >= since.getTime())
    const toppedCredits = recent.reduce((total, lot) => total + lot.credits, 0)
    const toppedVnd = recent.reduce((total, lot) => total + lot.priceVnd, 0)
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

const nextPlanOf = (
    plan: PlanView | null,
    selfServe: ReadonlyArray<PlanView>,
    lots: ReadonlyArray<TopupLot>,
    now: Date,
): NextPlan | null => {
    if (plan === null || plan.isCustom) return null
    const next = selfServe
        .filter((candidate) => candidate.price > plan.price && (candidate.credits ?? 0) > (plan.credits ?? 0))
        .sort((left, right) => left.price - right.price)[0]
    return next === undefined ? null : { plan: next, reason: reasonOf(plan, next, lots, now) }
}

const packViewsOf = (packs: ReadonlyArray<CreditPack>): Array<PackView> => {
    const base = packs[0]
    return packs.map((pack) => ({
        code: pack.code,
        credits: pack.credits,
        price: pack.priceVnd,
        perCredit: vndPerCredit(pack.priceVnd, pack.credits),
        discountPct:
            base === undefined
                ? 0
                : packDiscountPct(
                      { price: pack.priceVnd, credits: pack.credits },
                      { price: base.priceVnd, credits: base.credits },
                  ),
    }))
}

const topupExpiryOf = (topup: number, lots: ReadonlyArray<TopupLot>, now: Date): string | null =>
    topup > 0
        ? (lots
              .filter((lot) => lot.creditsRemaining > 0 && new Date(lot.expiresAt).getTime() > now.getTime())
              .map((lot) => lot.expiresAt)
              .sort()[0] ?? null)
        : null

/** Computes every figure the credits page shows from the rows the service read. */
export const overviewOf = (input: OverviewInput): CreditsOverview => {
    const views = input.plans.map(planViewOf)
    const selfServe = views.filter((view) => !view.isCustom)
    const plan = views.find((view) => view.code === input.workspace.planCode) ?? null
    const next = nextPlanOf(plan, selfServe, input.lots, input.now)
    const topup = input.status?.topupBalance ?? 0
    const limit = input.status === null ? (plan?.credits ?? null) : input.status.creditsLimit
    const used = input.status?.creditsUsed ?? 0
    return {
        canBuy: input.canBuy,
        paidUntil: input.workspace.paidUntil,
        workspaceStatus: input.workspace.status,
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
        packs: packViewsOf(input.packs),
        plans: selfServe,
        next,
        contact: next === null ? { plan: views.find((view) => view.isCustom) ?? null } : null,
        orders: input.orders.map(orderLineOf),
        bank: input.bank,
    }
}
