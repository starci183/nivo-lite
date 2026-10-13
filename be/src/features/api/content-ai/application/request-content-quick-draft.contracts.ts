/** Workspace-scoped arguments for requestContentQuickDraft. */
export interface RequestContentQuickDraftRequest {
    /** The selected workspace, verified by the domain service. */
    readonly workspaceId: string
    /** The pasted topic to turn into a draft. */
    readonly topic: string
    /** The social channels requested for the post. */
    readonly channels: ReadonlyArray<string>
}
