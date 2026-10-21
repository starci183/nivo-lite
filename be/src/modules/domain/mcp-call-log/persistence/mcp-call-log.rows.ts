/** One audit line as the console reads it, with the agent's name. */
export interface McpCallLogRow {
    /** The line. */
    readonly id: string
    /** The full tool name. */
    readonly tool: string
    /** The agent's name, or empty. */
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
