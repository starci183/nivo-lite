/** One grant row of an agent. */
export interface McpToolGrantRow {
    /** The full tool name or `connector.*`. */
    readonly tool: string
    /** `auto`, `ask` or `never`. */
    readonly mode: string
    /** The amount limit (bigint text from the driver), or null. */
    readonly limit_vnd: string | number | null
    /** The argument constraints (a JSON array). */
    readonly constraints: unknown
}

/** One grant row of a workspace with its agent. */
export interface McpWorkspaceGrantRow extends McpToolGrantRow {
    /** The agent. */
    readonly agent_id: string
    /** The agent's name. */
    readonly agent_name: string
}

/** The agent of a grant. */
export interface McpGrantAgentRow {
    /** The agent. */
    readonly agent_id: string
}

/** The id of a grant row a write touched. */
export interface McpGrantIdRow {
    /** The grant. */
    readonly id: string
}
