/** What list picked folder takes. */
export interface ListPickedFolderRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The Drive id of the picked folder. */
    readonly folderId: string
    /** The short-lived access token of the browser. */
    readonly token: string
}
