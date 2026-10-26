/**
 * Where an installation stands. `needs_connection`: applied, but a capability role its module requires has no usable connector,
 * so the agent does not run until one is connected (then it is live again); `paused` is the owner's own stop.
 */
export type InstallationStatus = "installing" | "setup" | "ready" | "live" | "paused" | "needs_connection"

/** The status a connection check left an installation in, or null when it did not change it. */
export type OptionalInstallationStatus = InstallationStatus | null

/** How an agent runs: it asks for everything (assist) or follows the authority rules alone (autopilot). */
export type InstallationMode = "assist" | "autopilot"

/** One installed agent of a workspace, with its agent and its active context version. */
export interface InstallationRecord {
    /** The installation. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The module key. */
    readonly moduleKey: string
    /** The label of the instance. */
    readonly name: string
    /** True when the type allows several instances. */
    readonly isMulti: boolean
    /** The agent of the instance; null when it has none. */
    readonly agentId: string | null
    /** The display name of the agent; empty when it has none. */
    readonly agentName: string
    /** The mention handle of the agent. */
    readonly agentHandle: string
    /** The HTTPS address of the agent's picture; null for the generated avatar or when there is no agent. */
    readonly agentAvatarUrl: string | null
    /** Where the installation stands. */
    readonly status: InstallationStatus
    /** How the agent runs. */
    readonly operatingMode: InstallationMode
    /** True when the agent acts on channels. */
    readonly liveEnabled: boolean
    /** The version in use; null before the first apply. */
    readonly activeContextVersionId: string | null
    /** The number of the version in use. */
    readonly activeVersion: number | null
    /** The settings of the instance (reply timeout, holding message...). */
    readonly settings: InstallationSettings
    /** When it was installed, ISO 8601. */
    readonly createdAt: string
}

/** An id, or null when there is none. */
export type OptionalRowId = string | null

/** The settings of an installation: a name to the value the owner saved. */
export interface InstallationSettings {
    /** One setting. */
    readonly [name: string]: unknown
}

/** An installation, or null when none matches. */
export type OptionalInstallationRecord = InstallationRecord | null

/** The name of an instance and its id. */
export interface InstanceName {
    /** The installation. */
    readonly id: string
    /** The label of the instance. */
    readonly name: string
}

/** What installing a module inserts. */
export interface NewInstallation {
    /** The workspace. */
    readonly workspaceId: string
    /** The module key. */
    readonly moduleKey: string
    /** The label of the instance. */
    readonly name: string
    /** The agent of the instance. */
    readonly agentId: string
    /** How the agent starts running. */
    readonly operatingMode: InstallationMode
}

/** Where the OpenClaw copy of the agent of an installation stands. */
export type AgentSyncState = "none" | "ok" | "error"

/** The OpenClaw copy of an agent against the context version that is active. */
export interface AgentSyncStatus {
    /** Where the copy stands. */
    readonly state: AgentSyncState
    /** The context version OpenClaw holds; null when there is no copy. */
    readonly syncedVersion: number | null
    /** The context version that is active in the database. */
    readonly activeVersion: number | null
    /** When the copy was last checked, ISO 8601. */
    readonly checkedAt: string | null
    /** The last failure, when the last sync failed. */
    readonly error: string | null
}

/** A sync status, or null when the installation is not of the workspace. */
export type OptionalAgentSyncStatus = AgentSyncStatus | null

/** What a workspace has, as far as the requirements of a module are concerned. */
export interface RequirementFacts {
    /** The connection providers that are connected. */
    readonly providers: ReadonlyArray<string>
    /** How many active chat agents (chatbot, booking) the workspace has. */
    readonly chatAgents: number
    /** How many active staff members the workspace has. */
    readonly staff: number
    /** How many active members the workspace has. */
    readonly members: number
}

/** The installation that owns a record, when one of the record tables names it. */
export interface RecordInstallation {
    /** The owning installation, or null when the record names none. */
    readonly installationId: string | null
}

/** An installation that runs on OpenClaw. */
export interface OpenclawInstallation {
    /** The installation. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
}
