/** The settle time of a wake's source: the quiet window and the longest wait after the oldest pending wake of the key. */
export interface AgentWakeSettle {
    /** How long the key must be quiet before its run starts, milliseconds. */
    readonly windowMs: number
    /** The longest wait after the oldest pending wake, milliseconds; null names none. */
    readonly maxWaitMs: number | null
}
