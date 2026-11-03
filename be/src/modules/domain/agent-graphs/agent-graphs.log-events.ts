/** Log events of the action graph: ids only, never a customer's words or a rule's text. */
export enum AgentGraphsLogEvent {
    /** A fact could not be read, so the branch fell to the else. */
    FactUnreadable = "agent_graphs.fact_unreadable",
    /** The request of a branch ask could not be opened, so the item stays with the people who govern. */
    AskNotRouted = "agent_graphs.ask_not_routed",
    /** The graph could not judge, so the action asks a person. */
    DecideFailed = "agent_graphs.decide_failed",
    /** The contracts and gaps of a setup could not be proposed; the setup itself stands. */
    ContractSetupFailed = "agent_graphs.contract_setup_failed",
    /** An intent the published graph reaches has no frame, so a turn is offered the other intents without it. */
    IntentUnframed = "agent_graphs.intent_unframed",
}
