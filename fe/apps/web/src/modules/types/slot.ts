/** The data status of one slot: loading, forbidden, failed, or its items (an empty list or an absent value reads as empty). */
export type DataSlot<T> = {
    readonly isLoading?: boolean | undefined
    readonly isForbidden?: boolean | undefined
    readonly isError?: boolean | undefined
    readonly items?: T | undefined
}

/** Resolved copy of the data-status recipe for one slot. */
export type SlotLabels = {
    readonly empty: string
    readonly forbidden: string
    readonly error: string
    readonly retry: string
}
