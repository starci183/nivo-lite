/** One read's exclusive status; only a settled ready slot carries items, and revalidation keeps its settled drawing. */
export type DataSlot<T> =
    | { readonly isLoading: true }
    | { readonly isForbidden: true }
    | { readonly isError: true }
    | { readonly isEmpty: true; readonly isValidating?: boolean }
    | { readonly items: T; readonly isValidating?: boolean }

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

/** A read folded into a region; errors remain unknown at the boundary. */
export interface SlotRead<T> {
    readonly data: T | undefined
    readonly error: unknown
    readonly isLoading: boolean
    readonly isValidating?: boolean
}
