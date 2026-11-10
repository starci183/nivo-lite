/** What the BrainGraph read takes. */
export interface GetBrainGraphRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** Only this subject (its key). */
    readonly subjectKey?: string | undefined
    /** Only truths whose subject, attribute or value hold every one of these words. */
    readonly query?: string | undefined
    /** The subject key the previous page ended at. */
    readonly cursor?: string | undefined
    /** How many subjects one page holds. */
    readonly limit?: number | undefined
}
