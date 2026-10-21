import type { AgentSyncStatus, InstallationStatus } from "../module-installations.contracts"

/** The status an update left an installation in. */
export interface StatusRow {
    /** The status. */
    readonly status: InstallationStatus
}

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
