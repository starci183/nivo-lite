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

/** What a pure block takes to draw one slot: the slot, a same-shape placeholder for its skeleton and the words of its status. */
export type SlotPanelProps<T> = {
    readonly slot: DataSlot<T>
    readonly placeholder: T
    readonly labels: SlotLabels
}
