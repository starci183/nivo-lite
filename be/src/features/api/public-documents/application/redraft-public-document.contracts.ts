/** What the RedraftPublicDocument operation takes. */
export interface RedraftPublicDocumentRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The public document. */
    readonly id: string
}
