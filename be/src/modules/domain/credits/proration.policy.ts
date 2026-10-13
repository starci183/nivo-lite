import type { Proration } from "./credits.contracts"

const DAY_MS = 86_400_000

/** A monthly plan period for proration. paid_until moves by one calendar month per renewal; 30 days is the billing convention. */
export const PRORATION_PERIOD_DAYS = 30

/** Charged amounts are rounded down to this many VND. */
export const VND_STEP = 1000

/** What the buyer pays now for an upgrade, from the two prices and the end of the period already paid. */
export interface UpgradeInput {
    /** The price of the plan the workspace is on. */
    readonly currentPrice: number
    /** The price of the plan it moves to. */
    readonly targetPrice: number
    /** The end of the paid period, ISO 8601. */
    readonly paidUntil: string
    /** The current instant. */
    readonly now: Date
}

/**
 * Upgrade price. The buyer already paid the current plan up to `paidUntil`; the days still left are worth
 *     credit = currentPrice x daysLeft / 30            (daysLeft = days from now to paid_until, rounded UP, never negative;
 *                                                       not capped at 30: a workspace that renewed twice has paid for both months)
 * and the upgrade charges the target price minus that credit:
 *     amount = max(0, floor((targetPrice - credit) / 1,000) x 1,000)
 * Rounding DOWN to 1,000 VND always favours the buyer, and the amount is never negative. The plan switches at once and paid_until
 * stays, so the buyer pays the target plan only for the rest of the period they had already bought.
 */
export const prorateUpgrade = (input: UpgradeInput): Proration => {
    const end = new Date(input.paidUntil).getTime()
    const daysLeft = Number.isFinite(end) ? Math.max(0, Math.ceil((end - input.now.getTime()) / DAY_MS)) : 0
    const credit = (input.currentPrice * daysLeft) / PRORATION_PERIOD_DAYS
    const amount = Math.max(0, Math.floor((input.targetPrice - credit) / VND_STEP) * VND_STEP)
    return { amount, credit: Math.round(credit), daysLeft }
}
