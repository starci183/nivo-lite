import { forecastRunout, packDiscountPct, topupSavings, vndPerCredit } from "@/modules/utils"
import Decimal from "decimal.js"
import { dayjs } from "@/modules/dayjs"
import { CREDITS_PER_USD } from "@/lib/usage-shared"
import type {
    BillingPlanType,
    BillingWorkspaceType,
    CreditPackType,
    CreditQuotaStatusType,
    CreditTopupLotType,
} from "@/modules/api"

/** Plain data of the credits page, and the pure functions that compute it from the rows the page read. */

import type { CreditsData, PlanView, UpgradeReason } from "@/modules/types"

/** How many months of top-ups the saving estimate looks back over. */
const SAVINGS_MONTHS = 2

/** The workspace columns the page reads. */
type WorkspaceFacts = Pick<BillingWorkspaceType, "status" | "planCode" | "paidUntil">

/** Everything the credits page is computed from. */
interface CreditsInput {
    readonly workspaceId: string
    readonly canBuy: boolean
    readonly workspace: WorkspaceFacts
    readonly plans: ReadonlyArray<BillingPlanType>
    readonly packs: ReadonlyArray<CreditPackType>
    readonly status: CreditQuotaStatusType | null
    readonly lots: ReadonlyArray<CreditTopupLotType>
    /** The model cost in USD of the last 7 days. */
    readonly last7CostUsd: number
    /** Today, YYYY-MM-DD (product calendar). */
    readonly today: string
    readonly now: Date
    /** Where "contact NIVO" goes. */
    readonly contactHref: string
}

const planViewOf = (plan: BillingPlanType): PlanView => ({
    code: plan.code,
    nameVi: plan.nameVi,
    nameEn: plan.nameEn,
    credits: plan.aiCreditsPerMonth ?? null,
    price: plan.priceVnd,
    perCredit: plan.aiCreditsPerMonth ? vndPerCredit(plan.priceVnd, plan.aiCreditsPerMonth) : 0,
    seats: plan.seats,
    isCustom: plan.isCustom,
})

/** Why `next` is recommended over `plan`: the top-ups it would replace, a lower price per credit, or nothing to claim. */
const reasonOf = (
    plan: PlanView,
    next: PlanView,
    lots: ReadonlyArray<CreditTopupLotType>,
    now: Date,
): UpgradeReason => {
    const since = dayjs.utc(now).subtract(SAVINGS_MONTHS, "month")
    const recent = lots.filter((lot) => dayjs(lot.purchasedAt).valueOf() >= since.valueOf())
    const toppedCredits = recent.reduce((total, lot) => total + lot.credits, 0)
    const toppedVnd = recent.reduce((total, lot) => total.plus(lot.priceVnd), new Decimal(0)).toNumber()
    const saving = topupSavings({
        toppedCredits,
        toppedVnd,
        months: SAVINGS_MONTHS,
        extraCredits: (next.credits ?? 0) - (plan.credits ?? 0),
        extraVnd: new Decimal(next.price).minus(plan.price).toNumber(),
    })
    if (saving > 0) return { kind: "topups", credits: toppedCredits, saving }
    if (plan.perCredit > 0 && next.perCredit > 0 && next.perCredit < plan.perCredit) {
        return {
            kind: "cheaper",
            pct: packDiscountPct({ price: next.perCredit, credits: 1 }, { price: plan.perCredit, credits: 1 }),
        }
    }
    return { kind: "plain" }
}

const topupExpiryOf = (topup: number, lots: ReadonlyArray<CreditTopupLotType>, now: Date): string | null =>
    topup > 0
        ? (lots
              .filter((lot) => lot.creditsRemaining > 0 && dayjs(lot.expiresAt).valueOf() > now.getTime())
              .map((lot) => lot.expiresAt)
              .sort()[0] ?? null)
        : null

/** Computes every figure the credits page shows from the rows the page read. */
export const creditsDataOf = (input: CreditsInput): CreditsData => {
    const views = input.plans.map(planViewOf)
    const selfServe = views.filter((view) => !view.isCustom)
    const plan = views.find((view) => view.code === input.workspace.planCode) ?? null
    const next =
        plan && !plan.isCustom
            ? (selfServe
                  .filter((candidate) => candidate.price > plan.price && (candidate.credits ?? 0) > (plan.credits ?? 0))
                  .sort((left, right) => left.price - right.price)[0] ?? null)
            : null
    const topup = input.status?.topupBalance ?? 0
    const limit = input.status ? (input.status.creditsLimit ?? null) : (plan?.credits ?? null)
    const used = input.status?.creditsUsed ?? 0
    const base = input.packs[0]
    return {
        workspaceId: input.workspaceId,
        canBuy: input.canBuy,
        paidUntil: input.workspace.paidUntil ?? null,
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
            price: pack.priceVnd,
            perCredit: vndPerCredit(pack.priceVnd, pack.credits),
            discountPct: base
                ? packDiscountPct(
                      { price: pack.priceVnd, credits: pack.credits },
                      { price: base.priceVnd, credits: base.credits },
                  )
                : 0,
        })),
        plans: selfServe,
        next: plan && next ? { plan: next, reason: reasonOf(plan, next, input.lots, input.now) } : null,
        contact: next ? null : { plan: views.find((view) => view.isCustom) ?? null, href: input.contactHref },
        orders: [],
        bank: { account: "", bank: "", holder: "" },
    }
}
