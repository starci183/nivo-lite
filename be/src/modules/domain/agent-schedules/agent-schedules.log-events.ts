/** Log events of the agent schedules: ids only, never the words of a customer or a colleague. */
export enum AgentSchedulesLogEvent {
    /** A probe found nothing to do, or failed, so no model ran. */
    ProbeSkipped = "agent_schedules.probe_skipped",
    /** A probe threw; the wake it guarded is skipped. */
    ProbeFailed = "agent_schedules.probe_failed",
    /** One thing the minute sweep looked at failed; the rest of the pass went on. */
    SweepItemFailed = "agent_schedules.sweep_item_failed",
    /** A trigger fired for a row that is gone or off, so its scheduler was removed. */
    OrphanUnscheduled = "agent_schedules.orphan_unscheduled",
    /** The minute sweep ended one pass. */
    SweepDone = "agent_schedules.sweep_done",
}
