/** What the agent-work capability takes from the app root; the app root decides whether it is global. */
export interface AgentWorkOptions {
    /**
     * The burst window of a conversation, in milliseconds: the messages a customer sends within it are one turn, and a turn waits until the
     * conversation has been quiet that long. Zero turns it off; 3000 when absent.
     */
    readonly debounceMs?: number | undefined
}
