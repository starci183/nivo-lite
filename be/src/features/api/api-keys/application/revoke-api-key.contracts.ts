/** What revoking an API key takes: the workspace and the key. */
export interface RevokeApiKeyRequest {
    /** The workspace of the key. */
    readonly workspaceId: string
    /** The key to revoke. */
    readonly keyId: string
}
