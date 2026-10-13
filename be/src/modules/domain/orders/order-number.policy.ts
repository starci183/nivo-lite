/** How many numbers are tried before the order is given up. */
export const ORDER_NUMBER_ATTEMPTS = 5

const SHOP_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The prefix of the order numbers of one day in shop time: `DH-20261013-`. */
export const orderPrefixOf = (now: Date): string =>
    `DH-${new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TIME_ZONE }).format(now).replaceAll("-", "")}-`

/** The candidate number of a draft: the channel's own number (suffixed on a clash) or the next number of the day. */
export const orderNumberOf = (given: string | null, prefix: string, taken: number, attempt: number): string => {
    if (given === null) return `${prefix}${String(taken + 1 + attempt).padStart(4, "0")}`
    return attempt === 0 ? given : `${given}-${10 + attempt}`
}
