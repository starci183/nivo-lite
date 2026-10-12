/** Log events of the agents capability. */
export enum AgentsLogEvent {
    /** A generation failed; the cause rides along. */
    GenerationFailed = "agents.generation_failed",
    /** A generation row ended in error on the engine side. */
    GenerationErrored = "agents.generation_errored",
    /** A region of the agent dashboard could not be read. */
    DashboardRegionFailed = "agents.dashboard_region_failed",
    /** The standing memory of the brain could not be read; the bundle goes without it. */
    MemoryUnavailable = "agents.memory_unavailable",
    /** An agent copy was written into its OpenClaw workspace. */
    AgentSynced = "agents.agent_synced",
    /** A sync failed and the failure was recorded on the sync row. */
    SyncFailed = "agents.sync_failed",
    /** The failure of a sync could not be recorded. */
    SyncFailureNotRecorded = "agents.sync_failure_not_recorded",
}
