import type { AgentTurnRequest, AgentTurnResult, GraphIntent } from "./agent-turns.contracts"

/** The replaceable seam under the executor: runs one turn on the runtime. */
export interface AgentTurnRunner {
    /** Whether the runtime is configured at all. */
    configured(): boolean
    /** Runs one turn and returns what the model proposes; it changes nothing outside the runtime. */
    run(request: AgentTurnRequest, signal: AbortSignal): Promise<AgentTurnResult>
}

/** What the action graph lets an agent ask for (owner: the action graph, bound at the app root). */
export interface AgentGraphBrief {
    /** The intents the active version of the agent's graph allows; none for an agent with no graph. */
    intentsOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<GraphIntent>>
}
