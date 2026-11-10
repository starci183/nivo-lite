/** What the ReindexKnowledgeSource operation takes. */
export interface ReindexKnowledgeSourceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The document. */
    readonly sourceId: string
    /** The new text; omitted keeps the text. */
    readonly content?: string | undefined
    /** A new upload of the same document, for a file; omitted keeps the file. */
    readonly storagePath?: string | undefined
}
