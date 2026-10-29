/** What one sync of an installation did. */
export interface SyncOutcome {
    /** The OpenClaw agent id. */
    readonly agentId: string
    /** The context version the files were built from. */
    readonly contextVersion: number | null
    /** False when the copy was already current and only the check time moved. */
    readonly changed: boolean
    /** Files created or rewritten. */
    readonly written: number
    /** Managed files removed. */
    readonly removed: number
    /** True when openclaw.json was rewritten. */
    readonly registered: boolean
    /** How many files the bundle has. */
    readonly files: number
    /** The hash over every file. */
    readonly contentHash: string
}

/** A sync outcome, or null when the installation is gone or not on OpenClaw and the sync was not forced. */
export type OptionalSyncOutcome = SyncOutcome | null

/** What a delivery of the event bus gives the inbox: the consumer's queue and the business key, claimed once per effect. */
export interface InboxClaim {
    /** The reactor's queue, the first half of the inbox key. */
    readonly consumer: string
    /** The business key of the fact, the second half. */
    readonly dedupeKey: string
}

/** A change of an installation as the event bus delivers it: no installation means the whole workspace. */
export interface InstallationChange {
    /** The workspace. */
    readonly workspaceId: string
    /** The one installation; the whole workspace when none. */
    readonly installationId?: string | null | undefined
    /** Also sync an installation that is not on OpenClaw yet. */
    readonly force: boolean
}

/** Which copy of the OpenClaw agents to rebuild. */
export interface SyncRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The one installation; the whole workspace when null. */
    readonly installationId: string | null
    /** Also sync an installation that is not on OpenClaw yet. */
    readonly force: boolean
}

/** What a sync job works on. */
export type SyncScope =
    | {
          readonly kind: "installation"
          readonly workspaceId: string
          readonly installationId: string
          readonly force: boolean
      }
    | { readonly kind: "workspace"; readonly workspaceId: string }
    | { readonly kind: "all" }

/** A sync scope, or null when the payload names an installation without its workspace. */
export type OptionalSyncScope = SyncScope | null

/** What a signed-in owner asks to sync: the optional parts default to the whole workspace and not forced. */
export interface SyncAsk {
    /** The workspace. */
    readonly workspaceId: string
    /** The one installation; the whole workspace when absent. */
    readonly installationId?: string
    /** Also sync an installation that is not on OpenClaw yet; false when absent. */
    readonly force?: boolean
}

/** The OpenClaw copy of the agent of an installation, as far as its status is concerned. */
export interface SyncCopy {
    /** Whether the last sync worked. */
    readonly status: "ok" | "error"
    /** The context version the files were built from. */
    readonly contextVersion: number | null
    /** When the copy was last checked. */
    readonly checkedAt: Date
    /** The last failure. */
    readonly error: string | null
}

/** The copy of an installation, or null when it has none. */
export type OptionalSyncCopy = SyncCopy | null

/** When the agent copies were last checked as ISO text, or null when none ever was. */
export type OptionalCheckTime = string | null
