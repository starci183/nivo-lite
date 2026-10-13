import Decimal from "decimal.js"
import { dayjs } from "@/modules/dayjs"

/** Client-safe estimates of the credits page; the back end determines every charge. */

/** Amounts are shown and compared in steps of this many VND. */
const VND_STEP = 1000

interface CreditPrice {
    readonly price: number
    readonly credits: number
}

interface RunoutInput {
    readonly remaining: number
    readonly last7Credits: number
    readonly today: string
}

interface TopupSavingsInput {
    readonly toppedCredits: number
    readonly toppedVnd: number
    readonly months: number
    readonly extraCredits: number
    readonly extraVnd: number
}

/** VND a credit costs at this price (whole dong). */
export const vndPerCredit = (priceVnd: number, credits: number): number =>
    credits > 0 ? new Decimal(priceVnd).div(credits).round().toNumber() : 0

/** How much cheaper a pack is than the base pack (the smallest one), as a whole percent; 0 when it is not cheaper. */
export const packDiscountPct = (pack: CreditPrice, base: CreditPrice): number => {
    if (base.credits <= 0 || pack.credits <= 0) return 0
    const basePrice = new Decimal(base.price).div(base.credits)
    const packPrice = new Decimal(pack.price).div(pack.credits)
    return basePrice.gt(0) && packPrice.lt(basePrice)
        ? new Decimal(1).minus(packPrice.div(basePrice)).mul(100).round().toNumber()
        : 0
}

const addDays = (day: string, n: number): string => dayjs.utc(`${day}T00:00:00Z`).add(n, "day").format("YYYY-MM-DD")

/**
 * The date (YYYY-MM-DD, Vietnam calendar) this month's allowance runs out at the average daily burn of the last 7 days, or null
 * when it does not run out this month (no recent use, already used up, or the date falls in a later month).
 */
export const forecastRunout = (a: RunoutInput): string | null => {
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
export const topupSavings = (a: TopupSavingsInput): number => {
    if (!(a.toppedCredits > 0) || !(a.months > 0) || !(a.extraCredits > 0)) return 0
    const perMonth = new Decimal(a.toppedCredits).div(a.months)
    const spend = new Decimal(a.toppedVnd).div(a.months)
    const avoided = spend.mul(Decimal.min(perMonth, a.extraCredits)).div(perMonth)
    const saving = avoided.minus(a.extraVnd).div(VND_STEP).floor().mul(VND_STEP)
    return Decimal.max(0, saving).toNumber()
}
