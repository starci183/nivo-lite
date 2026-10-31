/** Log events of the agent turns: ids only, never the words of a customer, a colleague or the model. */
export enum AgentTurnsLogEvent {
    /** A part of the context of a turn could not be read, so it was left out. */
    ContextPartFailed = "agent_turns.context_part_failed",
    /** An action the model proposed was dropped before it reached the engine. */
    ActionDropped = "agent_turns.action_dropped",
    /** A turn was refused before the model ran. */
    TurnBlocked = "agent_turns.turn_blocked",
    /** The runtime failed or was too slow for a customer's turn, so the customer gets the holding line. */
    TurnFailed = "agent_turns.turn_failed",
    /** The runtime agent of a turn could not be synced, so the turn ran on the workspace's internal agent. */
    AgentSyncFailed = "agent_turns.agent_sync_failed",
}
