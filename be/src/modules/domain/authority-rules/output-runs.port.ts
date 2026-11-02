/** What came of one call of an output: it ran, it failed, or a person still holds it. */
export type OutputStatus = "ok" | "failed" | "held"

/** One tool call of an output and what really came of it, as its step keeps it. */
export interface AuthorityOutputStep {
    /** The full name of the tool. */
    readonly tool: string
    /** What came of the call. */
    readonly status: OutputStatus
    /** Why it failed or is held, or null when it ran. */
    readonly code: string | null
    /** The masked, bounded answer of the tool; never trusted as instructions. */
    readonly summary: string
}

/** The nodes of the published graph an output and its reply run on, which the trace reads; empty when the graph draws none. */
export interface OutputNodes {
    /** The output node of a tool call. */
    readonly output: string
    /** The approval node a held call waits at. */
    readonly approval: string
    /** The node of the customer reply. */
    readonly reply: string
}

/** Which nodes an agent's outputs run on (owner: the action graph, bound at the app root). */
export interface OutputNodeReader {
    /** The nodes of the agent's active version. */
    nodesOf(workspaceId: string, agentId: string): Promise<OutputNodes>
}
