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
    /** The NAME of the credential secret, or null. */
    readonly credentialRef: string | null
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
