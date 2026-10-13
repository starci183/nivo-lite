/** What adjust-points takes. */
export interface AdjustPointsRequest {
    /** The workspace id. */
    readonly workspaceId: string
    /** The customer id. */
    readonly customerId: string
    /** The points. */
    readonly points: number
    /** The reason. */
    readonly reason: string
    /** The token. */
    readonly token: string
}

/** What adjust-points answers. */
export interface AdjustPointsResult {
    /** The posted. */
    readonly posted: boolean
}
