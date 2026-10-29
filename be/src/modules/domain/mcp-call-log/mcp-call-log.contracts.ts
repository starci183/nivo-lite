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

/** One audit line as the console reads it, with the agent name. */
export interface CallLogRecord {
    /** The line. */
    readonly id: string
    /** The full tool name. */
    readonly tool: string
    /** The agent name, or empty. */
    readonly agent_name: string
    /** The outcome. */
    readonly outcome: string
    /** The failure code, or null. */
    readonly error_code: string | null
    /** The masked arguments as JSON text. */
    readonly args_masked: string
    /** The masked result summary. */
    readonly result_summary: string
    /** How long it took, milliseconds. */
    readonly duration_ms: number
    /** Who approved, or null. */
    readonly approved_by: string | null
    /** When it was written. */
    readonly created_at: Date | string
}
