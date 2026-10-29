/** One instance of a module and the agent it runs. */
export interface InstallationAgentLink {
    /** The installation. */
    readonly id: string
    /** The agent of the instance; null when it has none. */
    readonly agentId: string | null
}
