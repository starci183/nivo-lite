const VND = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 })

/** An amount of Vietnamese dong as the owner reads it ("350.000 d"); a missing amount is empty. */
export const vndText = (amount: number | null | undefined): string =>
    amount === null || amount === undefined ? "" : VND.format(amount)

/** The instant of a timestamp the driver answered as a string or as a date, in epoch milliseconds. */
export const instantOf = (value: string | Date): number => new Date(value).getTime()

/** The ISO 8601 text of a timestamp the driver answered as a string or as a date. */
export const isoOf = (value: string | Date): string => new Date(value).toISOString()

/** The same value as an ISO text, or null when there is none. */
export const isoOrNull = (value: string | Date | null): string | null => (value === null ? null : isoOf(value))

/** The day (dd/mm/yyyy) of an ISO date (`yyyy-mm-dd`). */
export const dayText = (isoDay: string): string => isoDay.split("-").reverse().join("/")
