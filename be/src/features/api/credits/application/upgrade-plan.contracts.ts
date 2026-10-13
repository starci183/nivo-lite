/** What upgrading a plan takes. */
export interface UpgradePlanRequest {
    /** The workspace that pays. */
    readonly workspaceId: string
    /** The plan to move to. */
    readonly planCode: string
}
