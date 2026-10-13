/** Selectors for the caller's queued payment-order request. */
export interface PaymentOrderRequestStatusRequest {
    /** The selected workspace. */
    readonly workspaceId: string
    /** The payment-order request to poll. */
    readonly id: string
}
