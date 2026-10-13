/** What dismiss gap takes. */
export interface DismissGapRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The gap. */
    readonly id: string
}
