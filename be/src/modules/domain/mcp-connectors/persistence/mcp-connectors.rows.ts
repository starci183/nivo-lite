/** One public.mcp_connectors row as the statements select it. */
export interface McpConnectorRow {
    /** The namespace key. */
    readonly key: string
    /** The display name. */
    readonly name: string
    /** `native` or `remote`. */
    readonly kind: string
    /** The remote endpoint, or null for a native row. */
    readonly url: string | null
    /** The NAME of the credential secret, or null. */
    readonly credential_ref: string | null
    /** `active`, `disabled` or `degraded`. */
    readonly status: string
    /** The contract version. */
    readonly contract_version: string
    /** The per-call limit, milliseconds. */
    readonly timeout_ms: number
    /** The live tool catalog snapshot (a JSON array of { name, description, inputSchema, hash }). */
    readonly tool_catalog: unknown
    /** The sha256 of the live catalog text, or empty. */
    readonly catalog_hash: string
    /** The approved { name, hash } pairs (a JSON array). */
    readonly approved_catalog: unknown
    /** When the catalog was approved, ISO text, or null. */
    readonly approved_at: string | null
    /** When the last health check or catalog read answered or failed, ISO text, or null. */
    readonly checked_at: string | null
}

/** The key of a connector a write touched. */
export interface McpConnectorKeyRow {
    /** The namespace key. */
    readonly key: string
}
