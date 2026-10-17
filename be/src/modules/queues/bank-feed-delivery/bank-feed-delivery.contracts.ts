/** A committed workspace payment-feed receipt, consumed by the bank-feed delivery job. */
export interface BankFeedDeliveryRecorded {
    /** The authenticated provider that recorded the delivery. */
    readonly provider: "casso" | "payos" | "sepay-feed"
    /** The original connection-scoped provider delivery key. */
    readonly deliveryId: string
}
