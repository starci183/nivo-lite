/** What the DraftPublicDocument operation takes. */
export interface DraftPublicDocumentRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The title. */
    readonly title: string
    /** The internal documents to draft from. */
    readonly sourceIds: Array<string>
    /** A note for NIVO. */
    readonly instructions?: string | undefined
}
