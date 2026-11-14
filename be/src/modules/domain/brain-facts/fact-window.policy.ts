/** The validity window of a fact as stored: ISO instants, null for "from always" / "with no stated end". */
export interface FactWindowOf {
    /** From when the value applies, or null. */
    readonly validFrom: string | null
    /** Until when the value applies (exclusive end instant), or null. */
    readonly validTo: string | null
}

/** A window an edit states; a bound left out is not part of the edit. */
export interface StatedWindow {
    /** A new start, or absent / null. */
    readonly validFrom?: string | null | undefined
    /** A new end, or absent / null. */
    readonly validTo?: string | null | undefined
}

/** Two instants are the same when they name the same millisecond (an unreadable one is never the same). */
const sameInstant = (stored: string | null, stated: string): boolean =>
    stored !== null && Date.parse(stored) === Date.parse(stated)

/**
 * Whether an edit that keeps the value moves its validity window, so it is a CHANGE (the next version of the fact), never "the same
 * value again": a stated end that differs from the stored end, or a stated start that is still to come and differs from the stored
 * start. A start in the past (or now) on a value already in force changes nothing an agent reads, so it is not a move.
 */
export const windowMovedOf = (stored: FactWindowOf, stated: StatedWindow, nowMs: number): boolean => {
    const to = stated.validTo ?? null
    if (to !== null && !sameInstant(stored.validTo, to)) return true
    const from = stated.validFrom ?? null
    return from !== null && Date.parse(from) > nowMs && !sameInstant(stored.validFrom, from)
}

/** One bound of a stated window as a caller holds it: an instant, or none. */
export type WindowBound = string | null | undefined

/** Whether a stated window ends before (or when) it starts: refused at the door (the store's check `valid_to > valid_from` holds it too). */
export const windowEndsBeforeStart = (validFrom: WindowBound, validTo: WindowBound): boolean =>
    validFrom !== null &&
    validFrom !== undefined &&
    validTo !== null &&
    validTo !== undefined &&
    Date.parse(validTo) <= Date.parse(validFrom)

/** The dates of a value as any caller holds them: a bound may be null or left out. */
export interface ValueDates {
    /** From when it applies. */
    readonly validFrom?: string | null | undefined
    /** Until when it applies. */
    readonly validTo?: string | null | undefined
}

/**
 * Whether an end is the DEFAULT one a truth in force takes when nobody stated an end: exactly one calendar year after its start.
 * Such a truth is a standing value, not a period.
 */
const defaultEnd = (dates: ValueDates): boolean => {
    if (dates.validFrom === null || dates.validFrom === undefined || dates.validTo === null || dates.validTo === undefined) return false
    const year = new Date(dates.validFrom)
    year.setUTCFullYear(year.getUTCFullYear() + 1)
    return year.getTime() === Date.parse(dates.validTo)
}

/** Whether a value states a period: it has a stated end (the one-year default of a truth in force is no stated end). */
export const hasStatedPeriod = (dates: ValueDates): boolean => dates.validTo !== null && dates.validTo !== undefined && !defaultEnd(dates)

const instantOf = (written: string | null | undefined, open: number): number => (written === null || written === undefined ? open : Date.parse(written))

/**
 * Whether a waiting value ARGUES with another value of its key once their periods are read (date arithmetic only; values are the
 * caller's to compare). Two stated periods argue only when they overlap. A stated period over a standing value never argues: it
 * applies for its period and the standing value after it. A standing value argues with any other value in force, and with a
 * standing one that waits; a standing value and a period that both wait do not argue.
 */
export const windowsArgue = (value: ValueDates, other: ValueDates, otherInForce: boolean): boolean => {
    if (hasStatedPeriod(value) && hasStatedPeriod(other)) {
        const from = instantOf(value.validFrom, Number.NEGATIVE_INFINITY)
        const otherFrom = instantOf(other.validFrom, Number.NEGATIVE_INFINITY)
        return from < instantOf(other.validTo, Number.POSITIVE_INFINITY) && otherFrom < instantOf(value.validTo, Number.POSITIVE_INFINITY)
    }
    if (hasStatedPeriod(value)) return false
    return otherInForce || !hasStatedPeriod(other)
}
