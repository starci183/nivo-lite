/** The pending and failed steps belonging to one recorded inbound input. */
export interface InboundWorkState {
    /** Steps that still need their worker, including currently leased steps. */
    readonly queued: number
    /** Steps that failed permanently. */
    readonly failed: number
    /** Steps that now wait for a person instead of a worker. */
    readonly waiting: number
}
