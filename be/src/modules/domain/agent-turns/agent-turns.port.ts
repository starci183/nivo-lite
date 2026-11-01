import type { IntentAudience, IntentTrigger } from "@modules/domain/intent-contracts"
import type { AgentTurnRequest, AgentTurnResult, GraphIntent, OptionalTurnContracts } from "./agent-turns.contracts"

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
    /**
     * The contracts the published version holds for a trigger and an audience, or null: no graph, a graph in shadow, no active version, or
     * a reachable intent with no frame. Null leaves the turn on the prompt it had before contracts.
     */
    contractsOf(
        workspaceId: string,
        agentId: string,
        trigger: IntentTrigger,
        audience: IntentAudience,
    ): Promise<OptionalTurnContracts>
}
