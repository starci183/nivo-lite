/** Selects the workspace whose drafting permission is requested. */
export interface GetDraftingBlockedRequest {
    /** Selected workspace whose membership is enforced by the service. */
    readonly workspaceId: string
}
