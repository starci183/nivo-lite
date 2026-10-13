/**
 * A business event (`decision.made`, `order.confirmed`, `deal.won`, `payment.received`...) carried by the existing automation tick
 * job to the automation engine, which starts the pipelines that listen to it.
 */
export interface BusinessEventPayload {
    /** Distinguishes a business event from the minute scheduler's empty payload. */
    readonly kind: "business_event"
    /** The event name. */
    readonly event: string
    /** The workspace whose pipelines hear the event. */
    readonly workspaceId: string
    /** The occurrence: the same key never runs the engine twice. */
    readonly dedupe: string
    /** What the event carries. */
    readonly data: Readonly<Record<string, unknown>>
}

/** A reconciled payment whose customer may get a receipt by email, carried by the existing automation tick job. */
export interface PaymentReceiptEventPayload {
    /** Distinguishes a receipt request from the minute scheduler's empty payload. */
    readonly kind: "payment_receipt"
    /** The workspace of the payment. */
    readonly workspaceId: string
    /** The transaction, when the reconciled item is about one. */
    readonly transactionId: string | null
    /** The invoice the payment settled, when it is known. */
    readonly invoiceId: string | null
}

const isTextOrNull = (value: unknown): boolean => value === null || typeof value === "string"

/** True when the existing automation job carries a business event. */
export const isBusinessEventPayload = (value: unknown): value is BusinessEventPayload =>
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "business_event" &&
    "event" in value &&
    typeof value.event === "string" &&
    "workspaceId" in value &&
    typeof value.workspaceId === "string" &&
    "dedupe" in value &&
    typeof value.dedupe === "string" &&
    "data" in value &&
    typeof value.data === "object" &&
    value.data !== null

/** True when the existing automation job carries a payment receipt request. */
export const isPaymentReceiptEventPayload = (value: unknown): value is PaymentReceiptEventPayload =>
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "payment_receipt" &&
    "workspaceId" in value &&
    typeof value.workspaceId === "string" &&
    "transactionId" in value &&
    isTextOrNull(value.transactionId) &&
    "invoiceId" in value &&
    isTextOrNull(value.invoiceId)
