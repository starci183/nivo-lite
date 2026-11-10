import { orderAddressOf } from "@nivo-lite/blocks-core"

/** An order the customer can be asked to pay, read from its record. */
export interface PayableOrder {
    /** The order number. */
    readonly orderNo: string
    /** The total due, VND. */
    readonly amountVnd: number
    /** The items as the record keeps them. */
    readonly items: unknown
    /** Where it is delivered (its `deliveryAddress`, else the note of an older order); empty when none. */
    readonly address: string
}

/** Why an order cannot be asked for payment, with the values of the record that say so. */
export interface NotPayable {
    /** The reason. */
    readonly refused: "order_missing" | "order_not_payable"
    /** The status and the total of the record, as far as it has them. */
    readonly facts: Readonly<Record<string, string | number>>
}

/**
 * The order of a row when it can be asked for payment: it is confirmed and has a total above zero. A draft (it may still wait for the
 * owner), a paid, cancelled or failed order, and an order without a total are not payable; the answer says the status and the total the
 * record holds.
 */
export const payableOrderOf = (row: Readonly<Record<string, unknown>>): PayableOrder | NotPayable => {
    if (typeof row.orderNo !== "string") return { refused: "order_missing", facts: {} }
    const status = typeof row.status === "string" ? row.status : ""
    const amountVnd = typeof row.amountVnd === "number" ? row.amountVnd : null
    if (status !== "confirmed" || amountVnd === null || amountVnd <= 0) {
        return {
            refused: "order_not_payable",
            facts: { orderNo: row.orderNo, status, ...(amountVnd === null ? {} : { amountVnd }) },
        }
    }
    return { orderNo: row.orderNo, amountVnd, items: row.items, address: orderAddressOf(row) }
}
