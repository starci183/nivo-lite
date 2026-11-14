/** The decimals an exact credit figure keeps: below a millionth of a credit is float noise, not cost. */
const CREDIT_DECIMALS = 6
const MICRO = 10 ** CREDIT_DECIMALS

/** Millionths of a credit, an integer: what two credit figures are compared and summed in, so binary-float drift never decides. */
const microOf = (credits: number): number => (Number.isFinite(credits) ? Math.round(credits * MICRO) : 0)

/**
 * An exact credit figure from the database: `numeric` arrives as text (or a number when a driver parses it), kept at 6 decimals;
 * null is no credit. The database sums `cost_usd / credit value` as numeric and rounds the SUM to 6 decimals, never each call.
 */
export const creditsFromSql = (value: string | number | null | undefined): number =>
    value === null || value === undefined ? 0 : microOf(Number(value)) / MICRO

/** The exact sum of credit figures (6 decimals, no per-call rounding). */
export const sumCredits = (values: ReadonlyArray<number>): number =>
    values.reduce((total, value) => total + microOf(value), 0) / MICRO

/** Whether `used` reached `limit`, compared at 6 decimals. */
export const creditsAtLeast = (used: number, limit: number): boolean => microOf(used) >= microOf(limit)

/** Credits USED as people see them: the exact figure rounded half up to a whole number. */
export const creditsUsedShown = (exact: number): number => Math.floor((microOf(exact) + MICRO / 2) / MICRO)

/** Credits LEFT as people see them: the exact remainder floored, so never more than is left; nothing left is 0. */
export const creditsLeftShown = (exact: number): number => Math.max(0, Math.floor(microOf(exact) / MICRO))

/** One call's, node's or run's credits as text: a figure under half a credit is "<1", exactly nothing is "0", else the whole number. */
export const creditsFigureShown = (exact: number): string => {
    const micro = microOf(exact)
    return micro > 0 && micro < MICRO / 2 ? "<1" : String(creditsUsedShown(exact))
}

/** A cost in USD as booked (8 decimals, the column's scale), zero for anything that is not a cost. */
export const usdExact = (costUsd: number): number =>
    Number.isFinite(costUsd) && costUsd > 0 ? Number(costUsd.toFixed(8)) : 0
