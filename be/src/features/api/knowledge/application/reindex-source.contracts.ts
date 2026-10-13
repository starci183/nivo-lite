/** What reindex source takes. */
export interface ReindexSourceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The document. */
    readonly sourceId: string
    /** The new text; omitted keeps the text. */
    readonly content?: string
}
