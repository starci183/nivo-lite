/** One audit line of a gateway call, already masked by the gateway. */
export interface CallLogLine {
    /** The workspace. */
    readonly workspaceId: string
    /** The connector key. */
    readonly connector: string
    /** The full tool name. */
    readonly tool: string
    /** The agent. */
    readonly agentId: string | null
    /** The conversation the call served, or null. */
    readonly conversationId: string | null
    /** The work item the call served, or null. */
    readonly workItemId: string | null
    /** The masked arguments as JSON text. */
    readonly argsMaskedJson: string
    /** The sha256 of the canonical real arguments. */
    readonly argsHash: string
    /** `ok`, `error`, `refused`, `approval`, `timeout` or `circuit_open`. */
    readonly outcome: string
    /** The failure code, or null. */
    readonly errorCode: string | null
    /** The masked summary of the result. */
    readonly resultSummary: string
    /** How long it took, milliseconds. */
    readonly durationMs: number
    /** Who approved it, or null. */
    readonly approvedBy: string | null
}

/** Which audit lines to read: the newest of a workspace, at most `limit`. */
export interface CallLogPage {
    /** The workspace. */
    readonly workspaceId: string
    /** How many lines, already bounded by the caller. */
    readonly limit: number
}
