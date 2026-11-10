/** How a figure moved against the period before it. */
export type Change =
    | { readonly kind: "none" }
    | { readonly kind: "same" }
    | { readonly kind: "up" | "down"; readonly amount: number }

const NONE: Change = { kind: "none" }

const directed = (difference: number, amount: number): Change => {
    if (amount === 0) return { kind: "same" }
    return { kind: difference > 0 ? "up" : "down", amount }
}

/** How a number moved: in percent of the earlier one (none when there was nothing earlier to compare with) or by how many. */
export const changeOfNumber = (current: number, previous: number, unit: "percent" | "count"): Change => {
    if (unit === "count") return directed(current - previous, Math.abs(Math.round(current - previous)))
    if (previous === 0) return current === 0 ? { kind: "same" } : NONE
    return directed(current - previous, Math.abs(Math.round(((current - previous) / previous) * 100)))
}

/** How a rate (a share between zero and one) moved, in points; none while either period has no rate. */
export const changeOfRate = (current: number | null, previous: number | null): Change => {
    if (current === null || previous === null) return NONE
    return directed(current - previous, Math.abs(Math.round((current - previous) * 100)))
}
