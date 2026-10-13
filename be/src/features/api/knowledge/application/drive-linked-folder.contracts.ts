/** What the DriveLinkedFolder operation takes. */
export interface DriveLinkedFolderRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The address of the Drive folder. */
    readonly url: string
}
