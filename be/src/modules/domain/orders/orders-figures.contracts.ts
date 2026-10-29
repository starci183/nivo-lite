/** An order as the governance figures of the dashboard read it. */
export interface OrderFigure {
    /** The order id. */
    readonly id: string
    /** The customer, or null. */
    readonly leadId: string | null
    /** The order number. */
    readonly orderNo: string
    /** What was ordered. */
    readonly items: string
    /** The amount in VND, or null. */
    readonly amountVnd: number | null
    /** The state of the order. */
    readonly status: string
}
