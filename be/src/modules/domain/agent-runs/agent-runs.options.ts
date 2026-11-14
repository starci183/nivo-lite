/** What the agent-runs capability is told by the app root; every field has a default. */
export interface AgentRunsOptions {
    /** How many runs execute at once (`AGENT_RUNS_CONCURRENCY`); 100 when absent. */
    readonly concurrency?: number | undefined
    /**
     * How many runs of ONE workspace execute at once (`AGENT_RUNS_WORKSPACE_CONCURRENCY`); absent = the whole capacity (a self-hosted
     * install has one workspace and must reach it). Set lower only on a shared multi-tenant deployment.
     */
    readonly workspaceConcurrency?: number | undefined
}
