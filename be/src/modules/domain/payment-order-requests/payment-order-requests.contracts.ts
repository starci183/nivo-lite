/** The queue name: the contract between the rpc that creates a request (a pgmq message) and the processor of the create-payment-order job. */
export const PAYMENT_ORDER_REQUEST_QUEUE = "payment_order_requested"

/** What a member asked to pay. */
export type RequestKind = "plan" | "renew" | "topup" | "upgrade"

/** The payload of one create-payment-order job: ids only. */
export interface OrderRequestPayload {
    /** The workspace that pays. */
    readonly workspaceId: string
    /** The request row the answer is written to. */
    readonly requestId: string
}

/** True when a job payload is the payload of a create-payment-order job. */
export const isPaymentOrderRequestPayload = (value: unknown): value is OrderRequestPayload =>
    typeof value === "object" &&
    value !== null &&
    "workspaceId" in value &&
    typeof value.workspaceId === "string" &&
    "requestId" in value &&
    typeof value.requestId === "string"

/** What happened to a request. */
export type RequestOutcome = "ordered" | "failed" | "ignored"
