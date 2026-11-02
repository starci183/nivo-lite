/** What the UpdatePublicDocument operation takes. */
export interface UpdatePublicDocumentRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The public document. */
    readonly id: string
    /** The title. */
    readonly title?: string | undefined
    /** The text. */
    readonly body?: string | undefined
}
