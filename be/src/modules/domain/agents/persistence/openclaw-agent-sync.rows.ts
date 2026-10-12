/** The part of public.openclaw_agent_sync the next sync compares with. */
export interface SyncStateRow {
    /** The hash over the files last written. */
    content_hash: string | null
    /** ok or error. */
    status: string
}

/** The newest check of the syncs of a workspace. */
export interface SyncCheckRow {
    /** The newest checked_at, or null when no sync ran. */
    checked_at: string | null
}
