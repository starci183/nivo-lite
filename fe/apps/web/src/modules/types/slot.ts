/** The data status of one slot: loading, forbidden, failed, or its items (an empty list or an absent value reads as empty). */
export type DataSlot<T> = {
    readonly isLoading?: boolean
    readonly isForbidden?: boolean
    readonly isError?: boolean
    readonly items?: T
}

/** Resolved copy of the data-status recipe for one slot. */
export type SlotLabels = {
    readonly empty: string
    readonly forbidden: string
    readonly error: string
    readonly retry: string
}
