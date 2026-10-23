/** Workspace-scoped arguments for requestContentDraft. */
export interface RequestContentDraftRequest {
    /** The selected workspace, verified by the domain service. */
    readonly workspaceId: string
    /** The workspace-scoped row identifier. */
    readonly id: string
    /** Optional guidance for the generated rewrite. */
    readonly hint?: string | undefined
}
