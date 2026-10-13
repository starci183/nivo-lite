/** What the DrivePickedFolder operation takes. */
export interface DrivePickedFolderRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The Drive id of the folder. */
    readonly folderId: string
    /** The short-lived token of the browser; used for this call only. */
    readonly token: string
}
