/** The bounded request for get credit recent cost usd. */
export interface GetCreditRecentCostUsdRequest {
    /** The workspace selector; membership is proved by the handler. */
    readonly workspaceId: string
    /** First included day, YYYY-MM-DD. */
    readonly from: string
}
