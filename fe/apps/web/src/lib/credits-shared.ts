/** Client-safe money arithmetic of the credits page (the back end makes every figure that charges money). */

const DAY_MS = 86_400_000
/** Amounts are shown and compared in steps of this many VND. */
export const VND_STEP = 1000

/** VND a credit costs at this price (whole dong). */
export const vndPerCredit = (priceVnd: number, credits: number): number =>
    credits > 0 ? Math.round(priceVnd / credits) : 0

/** How much cheaper a pack is than the base pack (the smallest one), as a whole percent; 0 when it is not cheaper. */
export const packDiscountPct = (
    pack: { price: number; credits: number },
    base: { price: number; credits: number },
): number => {
    const b = base.price / base.credits
    const p = pack.price / pack.credits
    return b > 0 && p < b ? Math.round((1 - p / b) * 100) : 0
}

const addDays = (day: string, n: number): string =>
    new Date(new Date(`${day}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10)

/**
 * The date (YYYY-MM-DD, Vietnam calendar) this month's allowance runs out at the average daily burn of the last 7 days, or null
 * when it does not run out this month (no recent use, already used up, or the date falls in a later month).
 */
export const forecastRunout = (a: { remaining: number; last7Credits: number; today: string }): string | null => {
    const avg = a.last7Credits / 7
    if (!(a.remaining > 0) || !(avg > 0)) return null
    const date = addDays(a.today, Math.floor(a.remaining / avg))
    return date.slice(0, 7) === a.today.slice(0, 7) ? date : null
}

/**
 * Monthly VND saved by moving to the next plan instead of topping up, from the last months' real top-ups:
 *     topped credits per month C, spend per month S; the upgrade adds E credits for D more VND a month;
 *     the upgrade covers min(C, E) of the top-up credits, which would have cost S x min(C, E) / C.
 *     saving = S x min(C, E) / C - D, rounded down to 1,000; 0 when it is not positive (then the page makes no savings claim).
 */
export const topupSavings = (a: {
    toppedCredits: number
    toppedVnd: number
    months: number
    extraCredits: number
    extraVnd: number
}): number => {
    if (!(a.toppedCredits > 0) || !(a.months > 0) || !(a.extraCredits > 0)) return 0
    const perMonth = a.toppedCredits / a.months
    const spend = a.toppedVnd / a.months
    const avoided = (spend * Math.min(perMonth, a.extraCredits)) / perMonth
    const saving = Math.floor((avoided - a.extraVnd) / VND_STEP) * VND_STEP
    return saving > 0 ? saving : 0
}
