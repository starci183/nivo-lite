import { zoneDayOf } from "../../../shared/rules/zone-time"

/** How many numbers are tried before the order is given up. */
export const ORDER_NUMBER_ATTEMPTS = 5

/** The prefix of the order numbers of one day in the workspace's time zone: `DH-20261013-`. */
export const orderPrefixOf = (now: Date, timeZone: string): string =>
    `DH-${zoneDayOf(now.getTime(), timeZone).replaceAll("-", "")}-`

/** The candidate number of a draft: the channel's own number (suffixed on a clash) or the next number of the day. */
export const orderNumberOf = (given: string | null, prefix: string, taken: number, attempt: number): string => {
    if (given === null) return `${prefix}${String(taken + 1 + attempt).padStart(4, "0")}`
    return attempt === 0 ? given : `${given}-${String(10 + attempt)}`
}
