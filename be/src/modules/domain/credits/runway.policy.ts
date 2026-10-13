import { addDays } from "./calendar.policy"
import { VND_STEP } from "./proration.policy"

/** VND a credit costs at this price (whole dong). */
export const vndPerCredit = (priceVnd: number, credits: number): number =>
    credits > 0 ? Math.round(priceVnd / credits) : 0

/** How much cheaper a pack is than the base pack (the smallest one), as a whole percent; 0 when it is not cheaper. */
export const packDiscountPct = (
    pack: { readonly price: number; readonly credits: number },
    base: { readonly price: number; readonly credits: number },
): number => {
    const baseRate = base.price / base.credits
    const packRate = pack.price / pack.credits
    return baseRate > 0 && packRate < baseRate ? Math.round((1 - packRate / baseRate) * 100) : 0
}

/** What the run-out forecast reads. */
export interface RunoutInput {
    /** Credits left in this month's allowance. */
    readonly remaining: number
    /** Credits spent over the last 7 days. */
    readonly last7Credits: number
    /** Today, YYYY-MM-DD (Vietnam calendar). */
    readonly today: string
}

/**
 * The date (YYYY-MM-DD, Vietnam calendar) this month's allowance runs out at the average daily burn of the last 7 days, or null
 * when it does not run out this month (no recent use, already used up, or the date falls in a later month).
 */
export const forecastRunout = (input: RunoutInput): string | null => {
    const average = input.last7Credits / 7
    if (!(input.remaining > 0) || !(average > 0)) return null
    const date = addDays(input.today, Math.floor(input.remaining / average))
    return date.slice(0, 7) === input.today.slice(0, 7) ? date : null
}

/** What the saving estimate reads: the last months' real top-ups and what the next plan adds. */
export interface SavingsInput {
    /** Credits bought by top-ups over the months. */
    readonly toppedCredits: number
    /** VND paid for them. */
    readonly toppedVnd: number
    /** How many months the top-ups span. */
    readonly months: number
    /** Credits the next plan adds a month. */
    readonly extraCredits: number
    /** VND the next plan adds a month. */
    readonly extraVnd: number
}

/**
 * Monthly VND saved by moving to the next plan instead of topping up, from the last months' real top-ups:
 *     topped credits per month C, spend per month S; the upgrade adds E credits for D more VND a month;
 *     the upgrade covers min(C, E) of the top-up credits, which would have cost S x min(C, E) / C.
 *     saving = S x min(C, E) / C - D, rounded down to 1,000; 0 when it is not positive (then the page makes no savings claim).
 */
export const topupSavings = (input: SavingsInput): number => {
    if (!(input.toppedCredits > 0) || !(input.months > 0) || !(input.extraCredits > 0)) return 0
    const perMonth = input.toppedCredits / input.months
    const spend = input.toppedVnd / input.months
    const avoided = (spend * Math.min(perMonth, input.extraCredits)) / perMonth
    const saving = Math.floor((avoided - input.extraVnd) / VND_STEP) * VND_STEP
    return saving > 0 ? saving : 0
}
