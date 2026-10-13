/** Log events of the openclaw-agent-sync capability. */
export enum OpenclawAgentSyncLogEvent {
    /** An agent copy was written into its OpenClaw workspace. */
    AgentSynced = "openclaw_agent_sync.agent_synced",
    /** A sync failed and the failure was recorded on the sync row. */
    SyncFailed = "openclaw_agent_sync.sync_failed",
    /** The failure of a sync could not be recorded. */
    SyncFailureNotRecorded = "openclaw_agent_sync.sync_failure_not_recorded",
}
