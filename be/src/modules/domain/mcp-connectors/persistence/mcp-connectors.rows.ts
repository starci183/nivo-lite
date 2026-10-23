/** One public.mcp_connectors row as the statements select it; the sealed credential is never part of it. */
export interface McpConnectorRow {
    /** The namespace key. */
    readonly key: string
    /** The display name. */
    readonly name: string
    /** `native` or `remote`. */
    readonly kind: string
    /** The remote endpoint, or null for a native row. */
    readonly url: string | null
    /** `none` (the server takes no credential), `needed` (it takes one, none stored yet) or `set` (sealed in the row). */
    readonly credential_state: string
    /** When the credential was last set, ISO text, or null. */
    readonly credential_set_at: string | null
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

/** The sealed credential of a remote connector, as FIND_SEALED_CREDENTIAL selects it. */
export interface McpSealedCredentialRow {
    /** `none`, `needed` or `set`. */
    readonly credential_state: string
    /** The sealed credential (the connection-secrets cipher), or null. */
    readonly credential_sealed: string | null
}
