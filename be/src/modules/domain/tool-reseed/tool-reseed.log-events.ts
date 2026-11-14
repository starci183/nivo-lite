/** Log events of the tool re-seed. */
export enum ToolReseedLogEvent {
    /** `cli tools reseed --execute` ran: counts per store over every workspace, never a value. */
    Reseeded = "tool-reseed.reseeded",
    /** The re-seed of one agent failed; the other agents were still done. */
    AgentFailed = "tool-reseed.agent.failed",
}
