/** What asking for an upload address of the workspace logo takes. */
export interface RequestWorkspaceLogoUploadRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves they own or manage it. */
    readonly workspaceId: string
    /** The MIME type the browser reports. */
    readonly contentType: string
    /** The size in bytes. */
    readonly sizeBytes: number
}
