/** What list linked folder takes. */
export interface ListLinkedFolderRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The pasted folder link. */
    readonly url: string
}
