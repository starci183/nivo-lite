/** What asking for an upload address of an agent picture takes. */
export interface RequestAgentAvatarUploadRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves they govern its agents. */
    readonly workspaceId: string
    /** The MIME type the browser reports. */
    readonly contentType: string
    /** The size in bytes. */
    readonly sizeBytes: number
}
