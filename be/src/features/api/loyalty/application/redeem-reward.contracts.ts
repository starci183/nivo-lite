/** What redeem-reward takes. */
export interface RedeemRewardRequest {
    /** The workspace id. */
    readonly workspaceId: string
    /** The customer id. */
    readonly customerId: string
    /** The reward id. */
    readonly rewardId: string
    /** The token. */
    readonly token: string
}

/** What redeem-reward answers. */
export interface RedeemRewardResult {
    /** The code. */
    readonly code: string
    /** The posted. */
    readonly posted: boolean
}
