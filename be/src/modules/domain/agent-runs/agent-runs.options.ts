/** What the agent-runs capability is told by the app root; every field has a default. */
export interface AgentRunsOptions {
    /** How many runs one process drives at once; 4 when absent. */
    readonly concurrency?: number | undefined
}
