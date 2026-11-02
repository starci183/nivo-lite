import type { AgentTurnRequest, AgentTurnResult, IntentFileBundle, IntentFileRef } from "./agent-turns.contracts"

/** The replaceable seam under the executor: runs one turn on the runtime. */
export interface AgentTurnRunner {
    /** Whether the runtime is configured at all. */
    configured(): boolean
    /** Runs one turn and returns what the model proposes; it changes nothing outside the runtime. */
    run(request: AgentTurnRequest, signal: AbortSignal): Promise<AgentTurnResult>
}

/** What the files of a customer's message or a colleague's tag add to a turn (owner: the chat files, bound at the app root). */
export interface IntentFiles {
    /** The read of the files of a message, and the files; nothing when it holds none. */
    of(ref: IntentFileRef): Promise<IntentFileBundle>
}
