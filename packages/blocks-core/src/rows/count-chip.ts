/** The count chip of a card head. */
export interface CountChipFields {
    /** How many items the card holds. */
    readonly count?: number
    /** Whether the count is work waiting for the owner, so the chip is pink. */
    readonly isAttention?: boolean
}

/** The chip fields of a count that arrives as text: none when it is not a number; pink when it counts work waiting for the owner and is above zero. */
export const waitingChipOf = (count: string | null): CountChipFields => {
    const value = count === null ? Number.NaN : Number(count)
    return Number.isFinite(value) ? { count: value, isAttention: value > 0 } : {}
}
