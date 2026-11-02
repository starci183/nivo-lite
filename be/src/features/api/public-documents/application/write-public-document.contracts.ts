/** What the WritePublicDocument operation takes. */
export interface WritePublicDocumentRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The title. */
    readonly title: string
    /** The text. */
    readonly body: string
}
