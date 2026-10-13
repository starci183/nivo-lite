/** The workspace-scoped generation to poll. */
export interface GetContentAiStatusRequest {
    /** The selected workspace, verified by the domain service. */
    readonly workspaceId: string
    /** The workspace-scoped row identifier. */
    readonly id: string
}
