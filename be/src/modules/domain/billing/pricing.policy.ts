import type { Plan, PlanQuote, PlanSelection, PlanTier } from "./billing.contracts"
import { BillingError, BillingErrorCode } from "./errors/billing.error"

/** What a workspace already paid for plan months. */
export interface PromoHistory {
    /** Paid plan orders at full price: a workspace that has paid full price is not a new customer any more. */
    readonly fullPricePayments: number
    /** Paid plan orders at the intro price. */
    readonly promoPayments: number
}

/** The intro price is for the first paid months of a new customer, on the plan's own allowance, month by month. */
export const promoAvailable = (plan: Plan, history: PromoHistory): boolean =>
    plan.promoPriceVnd !== null &&
    plan.promoMonths !== null &&
    history.fullPricePayments === 0 &&
    history.promoPayments < plan.promoMonths

const tierOf = (plan: Plan, creditsPerMonth: number | null): PlanTier | null => {
    if (creditsPerMonth === null) {
        if (plan.perSeat) throw new BillingError({ code: BillingErrorCode.TierRequired })
        return null
    }
    if (!plan.perSeat && creditsPerMonth === plan.aiCreditsPerMonth) return null
    const found = plan.tiers.find((tier) => tier.creditsPerMonth === creditsPerMonth)
    if (found === undefined) throw new BillingError({ code: BillingErrorCode.TierUnknown })
    return found
}

const seatsOf = (plan: Plan, seats: number): number => {
    if (!plan.perSeat) return 1
    if (!Number.isInteger(seats) || seats < 1 || seats > plan.seats) {
        throw new BillingError({ code: BillingErrorCode.SeatsInvalid, params: { max: plan.seats } })
    }
    return seats
}

/**
 * The price of a plan selection, worked out from the catalogue only (never from the caller):
 *   monthly   the plan's own allowance costs the plan price, or the intro price while the promo is available; a usage tier costs its
 *             tier price (per seat on a per-seat plan, times the seats); a tier never carries the intro price
 *   annual    the plan's annual price for its own allowance; a tier costs 12 months less the plan's annual discount; a plan without an
 *             annual price (Team) is sold monthly only
 * A contract plan is never priced here.
 */
export const quoteSelection = (plan: Plan, selection: PlanSelection, history: PromoHistory): PlanQuote => {
    if (plan.isCustom) throw new BillingError({ code: BillingErrorCode.PlanCustom })
    const tier = tierOf(plan, selection.tierCredits)
    const seats = seatsOf(plan, selection.seats)
    const listMonthlyVnd = (tier === null ? plan.priceVnd : tier.priceVnd) * seats
    const creditsEach = tier === null ? plan.aiCreditsPerMonth : tier.creditsPerMonth
    const creditsPerMonth = creditsEach === null ? null : creditsEach * seats
    const common = {
        planCode: plan.code,
        listMonthlyVnd,
        tierCredits: tier === null ? null : tier.creditsPerMonth,
        seats,
        creditsPerMonth,
    }
    if (selection.cycle === "annual") {
        if (plan.priceAnnualVnd === null || plan.annualDiscountPct === null) {
            throw new BillingError({ code: BillingErrorCode.CycleUnavailable })
        }
        const amountVnd =
            tier === null
                ? plan.priceAnnualVnd
                : Math.floor((listMonthlyVnd * 12 * (100 - plan.annualDiscountPct)) / 100)
        return { ...common, cycle: "annual", months: 12, amountVnd, promo: false }
    }
    const promo = tier === null && plan.promoPriceVnd !== null && promoAvailable(plan, history)
    const amountVnd = promo && plan.promoPriceVnd !== null ? plan.promoPriceVnd : listMonthlyVnd
    return { ...common, cycle: "monthly", months: plan.period === "year" ? 12 : 1, amountVnd, promo }
}
