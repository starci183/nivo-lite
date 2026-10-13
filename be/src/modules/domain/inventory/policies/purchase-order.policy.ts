/** The digits of the running part of a purchase order number. */
const SEQUENCE_DIGITS = 4

/** The prefix of the purchase order numbers of the month `now` falls in, such as `PO-202610-`. */
export const poNumberPrefix = (now: Date): string =>
    `PO-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}-`

/** The next purchase order number after the last one of the month, or the first when the month has none. */
export const poNumberOf = (prefix: string, last: string | null): string => {
    const sequence = last === null ? 0 : Number(last.slice(prefix.length)) || 0
    return `${prefix}${String(sequence + 1).padStart(SEQUENCE_DIGITS, "0")}`
}
