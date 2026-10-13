/** What create upload takes. */
export interface CreateUploadRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The name of the file that will be uploaded. */
    readonly filename: string
}
