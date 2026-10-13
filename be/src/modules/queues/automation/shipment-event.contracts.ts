/** The durable shipment notification carried by the existing automation tick job. */
export interface ShipmentEventPayload {
    /** Distinguishes an order notification from the minute scheduler's empty payload. */
    readonly kind: "shipment"
    /** The workspace whose pipelines are evaluated. */
    readonly workspaceId: string
    /** The member who recorded the shipment. */
    readonly userId: string
    /** The shipped order. */
    readonly orderId: string
    /** The order number. */
    readonly orderNo: string
    /** The customer, when linked. */
    readonly leadId: string | null
    /** The recorded carrier. */
    readonly carrier: string
    /** The recorded tracking code. */
    readonly trackingCode: string
    /** The recorded shipment instant. */
    readonly shippedAt: string
}

/** True when the existing automation job carries a shipment notification. */
export const isShipmentEventPayload = (value: unknown): value is ShipmentEventPayload => {
    if (typeof value !== "object" || value === null) return false
    return (
        "kind" in value &&
        value.kind === "shipment" &&
        "workspaceId" in value &&
        typeof value.workspaceId === "string" &&
        "userId" in value &&
        typeof value.userId === "string" &&
        "orderId" in value &&
        typeof value.orderId === "string" &&
        "orderNo" in value &&
        typeof value.orderNo === "string" &&
        "leadId" in value &&
        (value.leadId === null || typeof value.leadId === "string") &&
        "carrier" in value &&
        typeof value.carrier === "string" &&
        "trackingCode" in value &&
        typeof value.trackingCode === "string" &&
        "shippedAt" in value &&
        typeof value.shippedAt === "string"
    )
}
