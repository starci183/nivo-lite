/** Workspace-scoped lookup of an asynchronous lead action. */
export interface LeadActionStatusRequest {
    /** The workspace selected by the caller. */
    readonly workspaceId: string
    /** The queued action identifier. */
    readonly id: string
}
