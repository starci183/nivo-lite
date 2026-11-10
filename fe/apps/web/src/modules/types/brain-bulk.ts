/** One internal document whose waiting facts can be applied together. */
export interface BulkGroupView {
    readonly id: string
    readonly title: string
    readonly count: number
    readonly label: string
}

/** The confirmation asked before a document's facts are applied together. */
export interface BulkConfirmView {
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
}

/** What the facts filter of the queue draws to apply the facts of one document together. */
export interface BulkApplyView {
    readonly groups: ReadonlyArray<BulkGroupView>
    readonly confirm: BulkConfirmView | null
    /** The document being applied, while the write runs. */
    readonly pendingId: string | null
}
