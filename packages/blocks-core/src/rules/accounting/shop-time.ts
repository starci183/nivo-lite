/** The offset of Vietnam from UTC, in milliseconds: the day a payment belongs to is the day on the shop's wall. */
export const SHOP_OFFSET_MS: number = 7 * 3_600_000

/** One day, in milliseconds. */
export const DAY_MS: number = 86_400_000

/** The shop's calendar day of an instant, `YYYY-MM-DD`. */
export const shopDayOf = (instant: string): string =>
    new Date(Date.parse(instant) + SHOP_OFFSET_MS).toISOString().slice(0, 10)

/** Noon on the shop's wall of a calendar day `YYYY-MM-DD`, in milliseconds: an instant surely inside that shop day; NaN for a text that is no day. */
export const shopNoonMsOf = (day: string): number => Date.parse(`${day}T12:00:00.000Z`) - SHOP_OFFSET_MS

/** The instant, in milliseconds, the shop's calendar month `back` months before the one holding `now` starts. */
export const monthStartMs = (now: Date, back: number): number => {
    const shifted = new Date(now.getTime() + SHOP_OFFSET_MS)
    return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() - back, 1) - SHOP_OFFSET_MS
}
