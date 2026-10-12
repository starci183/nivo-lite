/** The HTTP response of receive goods against a purchase order. */
export class ReceivePoResponse {
    /** The order status after the receipt. */
    status!: "partially_received" | "received"
    /** Lines received. */
    received!: number
    /** The lines whose price differed from the order. */
    priceChanges!: Array<string>
    /** The value of the goods. */
    payableVnd!: number
    /** Whether the payable went to Accounting. */
    handedToAccounting!: boolean
}
