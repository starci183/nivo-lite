/** Log events of the agent-knowledge capability. */
export enum AgentKnowledgeLogEvent {
    /** A part of the per-turn recall could not be read; the turn goes on without it. */
    RecallPartFailed = "agent-knowledge.recall.part-failed",
}
