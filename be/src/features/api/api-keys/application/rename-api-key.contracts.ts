/** What renaming an API key takes: the workspace, the key and its new name. */
export interface RenameApiKeyRequest {
    /** The workspace of the key. */
    readonly workspaceId: string
    /** The key to rename. */
    readonly keyId: string
    /** The new name. */
    readonly name: string
}
