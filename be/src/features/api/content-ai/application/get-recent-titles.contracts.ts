/** Selects recent workspace content titles while omitting the post being edited. */
export interface GetRecentTitlesRequest {
    /** Selected workspace whose membership is enforced by the service. */
    readonly workspaceId: string
    /** Stable identifier of the referenced content item or pillar. */
    readonly id: string
}
