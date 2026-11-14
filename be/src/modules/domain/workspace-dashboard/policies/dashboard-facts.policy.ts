import type { Compared } from "../workspace-dashboard.contracts"

/** A measure the database answered, as a number: text (bigint, numeric) is read, null and anything else is zero. */
export const numberOf = (value: unknown): number => {
    if (typeof value !== "number" && typeof value !== "string") return 0
    const read = Number(value)
    return Number.isFinite(read) ? read : 0
}

/** A figure in the period and in the period before it. */
export const comparedOf = (current: unknown, previous: unknown): Compared => ({
    current: numberOf(current),
    previous: numberOf(previous),
})

/** A part over its whole, 0..1; null while there is no whole (nothing to divide by is not zero percent). */
export const rateOf = (part: number, whole: number): number | null => (whole > 0 ? Math.min(1, part / whole) : null)
