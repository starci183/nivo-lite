/** Log events of the customer-turns capability. */
export enum CustomerTurnsLogEvent {
    /** A per-turn context block (hiring, authority) could not be read; the turn goes on without it. */
    ContextPartFailed = "customer-turns.context.part-failed",
    /** The OpenClaw turn failed or timed out; the customer gets the holding line. */
    TurnFailed = "customer-turns.turn.failed",
    /** A staff member could not be tagged on a waiting customer question; the item still waits in Decisions. */
    EscalationFailed = "customer-turns.escalation.failed",
    /** Draining the follow-up chain after a turn failed; the queued steps wait for the next drain. */
    DrainFailed = "customer-turns.drain.failed",
}
