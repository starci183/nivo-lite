/** Arguments for billingReviewTransactions. */
export interface BillingReviewTransactionsRequest {
    /** The selected workspace. */
    readonly workspaceId: string
    /** The orderIds selector. */
    readonly orderIds: ReadonlyArray<string>
}
