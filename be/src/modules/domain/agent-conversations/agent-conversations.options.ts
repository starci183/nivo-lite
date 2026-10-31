/**
 * The agent-conversations capability takes one option, set by the app root: the read-only mode (the mcp app) registers the
 * conversation lookups alone, with nothing that opens, changes or hands over a conversation.
 */
export interface AgentConversationsOptions {
    /** True registers the read-only mode; absent or false, the full capability. */
    readonly readOnly?: boolean
}
