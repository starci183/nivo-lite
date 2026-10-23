/** What the UpdateKnowledgeSource operation takes. */
export interface UpdateKnowledgeSourceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The document. */
    readonly sourceId: string
    /** A new title. */
    readonly title?: string | undefined
    /** A new topic; an empty text clears it. */
    readonly topic?: string | undefined
    /** New tags. */
    readonly tags?: Array<string> | undefined
    /** A new module; an empty text means every module. */
    readonly module?: string | undefined
    /** `public` or `internal`. */
    readonly visibility?: string | undefined
}
