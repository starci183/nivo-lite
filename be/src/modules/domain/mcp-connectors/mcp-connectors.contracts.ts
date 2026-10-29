/** A remote MCP connector to register or update in a workspace. */
export interface RemoteConnectorRecord {
    /** The workspace. */
    readonly workspaceId: string
    /** The namespace key. */
    readonly key: string
    /** The display name. */
    readonly name: string
    /** The Streamable HTTP endpoint. */
    readonly url: string
    /** True when the server takes a bearer credential (set separately, sealed); a stored one is kept. */
    readonly needsCredential: boolean
    /** The contract version. */
    readonly contractVersion: string
    /** The per-call limit, milliseconds. */
    readonly timeoutMs: number
}

/** The status a catalog read or a health check leaves a remote connector in. */
export type CheckStatus = "active" | "degraded"

/** A new live tool catalog snapshot of a connector, with the status the read left it in. */
export interface CatalogSnapshot {
    /** The workspace. */
    readonly workspaceId: string
    /** The connector key. */
    readonly key: string
    /** The catalog as JSON text (each entry with its schema hash). */
    readonly catalogJson: string
    /** The sha256 of the catalog text, or empty when the server could not be read. */
    readonly catalogHash: string
    /** `active` after a good read, `degraded` after a failed one. */
    readonly status: CheckStatus
}

/** The approval of the live catalog of a connector, exactly as an owner or manager saw it. */
export interface CatalogApproval {
    /** The workspace. */
    readonly workspaceId: string
    /** The connector key. */
    readonly key: string
    /** The approved { name, hash } pairs as JSON text. */
    readonly approvedJson: string
    /** The hash of the live catalog the approval was made on; a catalog read since then voids the approval. */
    readonly catalogHash: string
    /** The person who approved. */
    readonly approvedBy: string
}

/** What one health check of a connector found. */
export interface HealthRecord {
    /** The workspace. */
    readonly workspaceId: string
    /** The connector key. */
    readonly key: string
    /** `active` when the server answered, `degraded` when it did not. */
    readonly status: CheckStatus
}

/** A remote connector's credential, sealed by the connection-secrets cipher, to store in its row. */
export interface SealedCredentialRecord {
    /** The workspace. */
    readonly workspaceId: string
    /** The connector key. */
    readonly key: string
    /** The sealed text; the plain value never reaches this capability. */
    readonly sealed: string
    /** The person who set it. */
    readonly setBy: string
}

/** Whether a remote connector takes a credential (`none` = no) and whether one is stored (`needed` = not yet, `set` = sealed). */
export type CredentialState = "none" | "needed" | "set"

/** The stored credential of a remote connector: its state and the sealed text when it is set. */
export interface StoredConnectorCredential {
    /** `none`, `needed` or `set`. */
    readonly state: CredentialState
    /** The sealed text, or null unless the state is `set`. */
    readonly sealed: string | null
}

/** The stored credential of a remote connector, or null when there is no such remote connector. */
export type OptionalStoredConnectorCredential = StoredConnectorCredential | null

/** One sealed connector credential, or null when none is sealed in any workspace. */
export type OptionalSealedCredential = string | null

/** One public.mcp_connectors row as the list answers it; the sealed credential is never part of it. */
export interface McpConnectorRecord {
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
