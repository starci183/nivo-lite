/** One agent a seed keeps, as the agents owner writes it. Owned by the agents capability (table agents). */
export interface SeedAgent {
    /** The workspace. */
    readonly workspaceId: string
    /** The module (agent type). */
    readonly module: string
    /** The display name. */
    readonly name: string
    /** The @handle; the key. */
    readonly handle: string
    /** The one-line role. */
    readonly role: string
    /** The owner-facing instructions. */
    readonly instructions: string
}

/** The agents owner: keeps an agent by its handle and answers its id. */
export interface SeedAgentRecords {
    /** Inserts the agent or updates the one with its handle; answers the agent id. */
    ensureByHandle(agent: SeedAgent): Promise<string>
}
