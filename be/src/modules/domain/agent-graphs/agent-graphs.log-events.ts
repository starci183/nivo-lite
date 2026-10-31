/** Log events of the action graph: ids only, never a customer's words or a rule's text. */
export enum AgentGraphsLogEvent {
    /** A fact could not be read, so the branch fell to the else. */
    FactUnreadable = "agent_graphs.fact_unreadable",
    /** A graph in shadow answered differently from the gate. */
    ShadowDiffered = "agent_graphs.shadow_differed",
    /** The request of a branch ask could not be opened, so the item stays with the people who govern. */
    AskNotRouted = "agent_graphs.ask_not_routed",
    /** The graph could not decide and left the item to the gate. */
    DecideFailed = "agent_graphs.decide_failed",
}
