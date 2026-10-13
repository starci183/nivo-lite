/** What ordering the first payment of a plan takes. */
export interface OrderPlanRequest {
    /** The workspace to pay for. */
    readonly workspaceId: string
    /** The plan to buy. */
    readonly planCode: string
}
