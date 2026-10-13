/** The newest check of the syncs of a workspace, read from public.openclaw_agent_sync. */
export interface SyncCheckRow {
    /** The newest checked_at, or null when no sync ran. */
    checked_at: string | null
}
