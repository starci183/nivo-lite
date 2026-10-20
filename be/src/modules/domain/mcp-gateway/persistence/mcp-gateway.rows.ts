/** One mcp_connectors row. */
export interface ConnectorRow {
    readonly key: string
    readonly name: string
    readonly kind: string
    readonly url: string | null
    readonly credential_ref: string | null
    readonly status: string
    readonly contract_version: string
    readonly timeout_ms: number
    readonly tool_catalog: unknown
}

/** One grant row. */
export interface GrantRow {
    readonly tool: string
    readonly mode: string
    readonly limit_vnd: string | number | null
    readonly constraints: unknown
}

/** One grant row with its agent. */
export interface WorkspaceGrantRow extends GrantRow {
    readonly agent_id: string
    readonly agent_name: string
}

/** One audit row. */
export interface CallLogRow {
    readonly id: string
    readonly tool: string
    readonly agent_name: string
    readonly outcome: string
    readonly error_code: string | null
    readonly args_masked: string
    readonly result_summary: string
    readonly duration_ms: number
    readonly approved_by: string | null
    readonly created_at: Date | string
}

/** An agent id. */
export interface AgentIdRow {
    readonly agent_id: string
}
