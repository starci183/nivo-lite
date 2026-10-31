/** Log events of the agent work store: ids only, never the words of a customer or a colleague. */
export enum AgentWorkLogEvent {
    /** A new fact woke an agent. */
    WakeWritten = "agent_work.wake_written",
    /** A worker took a turn. */
    TurnBegun = "agent_work.turn_begun",
    /** The scope was already held by another worker. */
    TurnBusy = "agent_work.turn_busy",
    /** A probe found nothing to do, or failed, so no model ran. */
    ProbeSkipped = "agent_work.probe_skipped",
    /** A worker lost its lease and stopped before any effect. */
    TurnFenced = "agent_work.turn_fenced",
    /** A wake spent its attempts and was given up. */
    WakeDead = "agent_work.wake_dead",
    /** Five failed turns in a row held the agent's background work. */
    BreakerOpened = "agent_work.breaker_opened",
    /** A wake had no handler, so it was held. */
    NoHandler = "agent_work.no_handler",
    /** A turn failed and will be retried or given up. */
    TurnFailed = "agent_work.turn_failed",
    /** The heartbeat could not renew the lease. */
    HeartbeatFailed = "agent_work.heartbeat_failed",
}
