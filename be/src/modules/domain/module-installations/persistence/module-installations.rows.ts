import type { AgentSyncStatus } from "../module-installations.contracts"

/** An id the insert or a one-column read answers. */
export interface IdRow {
    /** The id. */
    id: string
}

/** The OpenClaw copy of an installation as the status reads it; `state` is the stored sync status text. */
export interface SyncStatusRow extends Omit<AgentSyncStatus, "state"> {
    /** `ok` or `error`; null when the installation has no copy yet. */
    state: string | null
}
