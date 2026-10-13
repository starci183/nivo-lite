/** What update source takes. */
export interface UpdateSourceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The document. */
    readonly sourceId: string
    /** A new title. */
    readonly title?: string
    /** A new topic; an empty text clears it. */
    readonly topic?: string
    /** New tags. */
    readonly tags?: ReadonlyArray<string>
    /** A new module; an empty text means every module. */
    readonly module?: string
    /** public or internal. */
    readonly visibility?: string
}
