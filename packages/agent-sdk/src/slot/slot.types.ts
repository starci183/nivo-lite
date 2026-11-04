/** One read's exclusive status; only a settled ready slot carries items, and revalidation keeps its settled drawing. */
export type DataSlot<T> =
    | { readonly isLoading: true }
    | { readonly isForbidden: true }
    | { readonly isError: true }
    | { readonly isEmpty: true; readonly isValidating?: boolean }
    | { readonly items: T; readonly isValidating?: boolean }

/** Resolved copy of the data-status recipe for one slot. */
export type SlotLabels = {
    /** The notice of a read that settled with nothing to draw. */
    readonly empty: string
    /** The notice of a read the viewer may not see. */
    readonly forbidden: string
    /** The notice of a read that failed. */
    readonly error: string
    /** The words on the control that reads again after a failure. */
    readonly retry: string
}

/** What a pure block takes to draw one slot: the slot, a same-shape placeholder for its skeleton and the words of its status. */
export type SlotPanelProps<T> = {
    /** The status of the read to draw. */
    readonly slot: DataSlot<T>
    /** Data with the geometry of settled data, drawn as a skeleton while the read loads. */
    readonly placeholder: T
    /** The words of every status except ready. */
    readonly labels: SlotLabels
}

/** A read folded into a region; errors remain unknown at the boundary. */
export interface SlotRead<T> {
    /** What the read yielded; undefined until it settles. */
    readonly data: T | undefined
    /** The failure of the read; undefined when it did not fail. */
    readonly error: unknown
    /** Whether the first run of the read is in flight. */
    readonly isLoading: boolean
    /** Whether the read runs again while its data shows. */
    readonly isValidating?: boolean
}

/** Tells a forbidden failure from any other; the host owns the failure vocabulary of its transport. */
export type ForbiddenTest = (error: unknown) => boolean
