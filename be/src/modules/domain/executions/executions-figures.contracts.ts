/** A draft waiting for a decision, as a dashboard lists it. */
export interface PendingExecution {
    /** The execution id. */
    readonly id: string
    /** The step the draft belongs to. */
    readonly responsibilityId: string
    /** When the draft was created. */
    readonly createdAt: Date
}
