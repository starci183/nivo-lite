/** The input and its first department's work as a simulator status poll reads them. */
export interface SimulationResultRow {
    /** The stored inbound event. */
    readonly id: string
    /** The channel's own event identity. */
    readonly event_id: string | null
    /** How many redeliveries were counted. */
    readonly duplicate_count: number
    /** The amount in VND. */
    readonly amount_vnd: number | null
    /** The lead the work created. */
    readonly lead_id: string | null
    /** Where the input stands. */
    readonly status: string
    /** The first work item, when one was created. */
    readonly work_id: string | null
    /** The first item's department. */
    readonly work_department: string | null
    /** The first item's state. */
    readonly work_status: string | null
    /** All pending steps of the input, including lease-held work. */
    readonly queued_count: number
    /** Any failed child makes the complete input fail. */
    readonly failed_count: number
    /** Human decisions are terminal for this job, rather than pending worker work. */
    readonly waiting_count: number
}

/** A database-generated event identity for an input that supplied none. */
export interface SimulationEventIdentityRow {
    /** The fresh event identity. */
    readonly id: string
}
