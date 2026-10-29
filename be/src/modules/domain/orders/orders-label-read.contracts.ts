/** The number an order shows. */
export interface OrderNumber {
    /** The order id. */
    readonly id: string
    /** The order number. */
    readonly orderNo: string
}

/** An order as another capability shows it next to its own record. */
export interface OrderSummary {
    /** The order id. */
    readonly id: string
    /** The order number. */
    readonly orderNo: string
    /** The items, as text. */
    readonly items: string
    /** The amount, VND, or null. */
    readonly amountVnd: number | null
    /** The order status. */
    readonly status: string
}
