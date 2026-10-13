/** Log events of the agent-knowledge capability. */
export enum AgentKnowledgeLogEvent {
    /** A part of the per-turn recall could not be read; the turn goes on without it. */
    RecallPartFailed = "agent-knowledge.recall.part-failed",
    /** Noting a knowledge gap failed; the customer's reply is never affected. */
    GapNoteFailed = "agent-knowledge.gap.note-failed",
}
