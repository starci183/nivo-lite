/** A connection with its sealed credential, as FIND_CONNECTION_SECRET selects it. */
export interface ConnectionSecretRow {
    /** The workspace the connection belongs to. */
    readonly workspace_id: string
    /** The provider key. */
    readonly provider: string
    /** The connection status. */
    readonly status: string
    /** The sealed credential. */
    readonly ciphertext: string
    /** The random secret of the connection's own webhook. */
    readonly webhook_secret: string
    /** When the access token ends, ISO 8601. */
    readonly token_expires_at: string | null
}

/** The id of a lease taken or of a due Zalo connection. */
export interface ConnectionIdRow {
    /** The connection id. */
    readonly connection_id: string
}
