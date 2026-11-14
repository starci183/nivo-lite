/** How a figure moved against the period before it. */
export type Change =
    | { readonly kind: "same" }
    | { readonly kind: "up" | "down"; readonly amount: number }

const directed = (difference: number, amount: number): Change => {
    if (amount === 0) return { kind: "same" }
    return { kind: difference > 0 ? "up" : "down", amount }
}

/** How a number moved: by how many it rose or fell against the earlier one. */
export const changeOfNumber = (current: number, previous: number): Change =>
    directed(current - previous, Math.abs(Math.round(current - previous)))
