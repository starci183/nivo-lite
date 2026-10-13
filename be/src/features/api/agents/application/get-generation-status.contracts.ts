/** What reading the status of a queued text takes. */
export interface GetGenerationStatusRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The queued text. */
    readonly generationId: string
}
