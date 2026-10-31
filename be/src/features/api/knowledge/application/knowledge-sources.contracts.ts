/** What the KnowledgeSources operation takes. */
export interface KnowledgeSourcesRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** Only the documents of this module. */
    readonly module?: string | undefined
    /** Only the documents that came from this origin, e.g. `google_drive`. */
    readonly origin?: string | undefined
}
