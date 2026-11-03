/** What the agent-work capability takes from the app root; the app root decides whether it is global. */
export interface AgentWorkOptions {
    /**
     * The burst window of a conversation, in milliseconds: every new message of the conversation extends the wait by this much, and a turn
     * starts once the conversation has been quiet that long, with every pending message in it. Zero turns it off; 6000 when absent.
     */
    readonly debounceMs?: number | undefined
    /** The longest a burst may keep a turn waiting, counted from its first message, in milliseconds; 20000 when absent. */
    readonly debounceMaxMs?: number | undefined
}
