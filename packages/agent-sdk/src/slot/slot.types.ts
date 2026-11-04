/** One read's exclusive status; only a settled ready slot carries items, and revalidation keeps its settled drawing. */
export type DataSlot<T> =
    | { readonly isLoading: true }
    | { readonly isForbidden: true }
    | { readonly isError: true }
    | { readonly isEmpty: true; readonly isValidating?: boolean }
    | { readonly items: T; readonly isValidating?: boolean }

/** Resolved copy of the data-status recipe for one slot. */
export type SlotLabels = {
    /** The sentence drawn for an empty slot. */
    readonly empty: string
    /** The sentence drawn when the viewer lacks the permission. */
    readonly forbidden: string
    /** The sentence drawn when the read failed. */
    readonly error: string
    /** The label of the control that reads again. */
    readonly retry: string
}

/** What a pure block takes to draw one slot: the slot, a same-shape placeholder for its skeleton and the words of its status. */
export type SlotPanelProps<T> = {
    /** The read as one exclusive status. */
    readonly slot: DataSlot<T>
    /** A value of the same shape as the data, drawn as a skeleton while the read loads. */
    readonly placeholder: T
    /** The words of the slot's empty, forbidden and error states. */
    readonly labels: SlotLabels
}

/** A read folded into a region; errors remain unknown at the boundary. */
export interface SlotRead<T> {
    /** The settled data; undefined until the read has any. */
    readonly data: T | undefined
    /** The failure of the read, unknown until the host classifies it. */
    readonly error: unknown
    /** True while the first answer has not arrived. */
    readonly isLoading: boolean
    /** True while a settled read is refreshing; the settled drawing stays. */
    readonly isValidating?: boolean
}

/** Tells a forbidden failure from any other; the host owns the failure vocabulary of its transport. */
export type ForbiddenTest = (error: unknown) => boolean
