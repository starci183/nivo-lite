/**
 * The agent-messages capability takes one option, set by the app root: the read-only mode (the mcp app) registers the message feed
 * read alone, with nothing that stores, delivers or marks a message.
 */
export interface AgentMessagesOptions {
    /** True registers the read-only mode; absent or false, the full capability. */
    readonly readOnly?: boolean
}
