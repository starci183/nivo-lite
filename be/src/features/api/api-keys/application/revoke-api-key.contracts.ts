/** What revoking an API key takes: the workspace and the key. */
export interface RevokeApiKeyRequest {
    /** The workspace of the key; the caller must manage it. */
    readonly workspaceId: string
    /** The key to revoke. */
    readonly keyId: string
}

/** What revoking an API key answers: the key as it is now, with its revocation time. */
export interface RevokeApiKeyResult {
    /** The key id. */
    readonly id: string
    /** The name of the key. */
    readonly name: string
    /** The first characters of the key. */
    readonly prefix: string
    /** When the key was created, ISO 8601. */
    readonly createdAt: string
    /** When the key last authenticated a request, ISO 8601, or null. */
    readonly lastUsedAt: string | null
    /** When the key was revoked, ISO 8601. */
    readonly revokedAt: string | null
}
