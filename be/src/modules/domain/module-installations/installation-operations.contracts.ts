/** One instance of a module and the agent it runs. */
export interface InstallationAgentLink {
    /** The installation. */
    readonly id: string
    /** The agent of the instance; null when it has none. */
    readonly agentId: string | null
}

/** The id of one installation, or null when the module's oldest instance is meant. */
export type OptionalInstallationId = string | null

/** How an instance runs (its operating mode), or null when the module has no such instance. */
export type OptionalOperatingMode = string | null
