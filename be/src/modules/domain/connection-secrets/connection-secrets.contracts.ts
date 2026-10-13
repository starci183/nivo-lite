/** A connection credential opened for the server. */
export interface ConnectionSecret {
    /** The workspace the connection belongs to. */
    readonly workspaceId: string
    /** The decrypted credential: a bot token, or a JSON document for Zalo and SMTP. */
    readonly credential: string
    /** The random secret of the connection's own webhook. */
    readonly webhookSecret: string
    /** When the access token ends, ISO 8601, for the providers that have one. */
    readonly tokenExpiresAt: string | null
}
