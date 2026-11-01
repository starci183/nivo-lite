import type { InboundTrust, IntentGap, IntentTrigger } from "@modules/domain/intent-contracts"
import type {
    AgentTurnRequest,
    AgentTurnResult,
    GraphIntent,
    IntentFileBundle,
    IntentFileRef,
    IntentNodeKeys,
    OptionalTurnContracts,
} from "./agent-turns.contracts"

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
     * The contracts the published version holds for a trigger and an trust, or null: no graph, a graph in shadow, no active version, or
     * a reachable intent with no frame. Null leaves the turn on the prompt it had before contracts.
     */
    contractsOf(
        workspaceId: string,
        agentId: string,
        trigger: IntentTrigger,
        trust: InboundTrust,
    ): Promise<OptionalTurnContracts>
    /** The node keys of the active version the steps of a turn stand for. */
    nodeKeysOf(workspaceId: string, agentId: string): Promise<IntentNodeKeys>
    /** Raises the gap a turn found as a proposal for the owner, once per agent and question; false when it was already raised. */
    raiseGap(gap: IntentGap): Promise<boolean>
}

/** What the files of a customer's message or a colleague's tag add to a turn (owner: the chat files, bound at the app root). */
export interface IntentFiles {
    /** The read of the files of a message, and the files; nothing when it holds none. */
    of(ref: IntentFileRef): Promise<IntentFileBundle>
}
