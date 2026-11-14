import { ORDER_ITEMS_SHAPE } from "../../entities/sales/order.entity"

/** A line of a recorded order as the order data port reads it. */
export interface OrderLine {
    /** The item name. */
    readonly name: string
    /** How many. */
    readonly qty: number
}

/**
 * The lines of an order as its record keeps them: `items` is an object that holds the lines (`{ lines: [{ name, qty, unitVnd, amountVnd }] }`), not
 * a list. A value that is not that shape (a record from before the lines were kept, a damaged one) has no lines.
 */
export const orderLinesOf = (items: unknown): ReadonlyArray<OrderLine> => {
    const parsed = ORDER_ITEMS_SHAPE.safeParse(items)
    return parsed.success ? parsed.data.lines.map((line) => ({ name: line.name, qty: line.qty })) : []
}

/** The transfer content of an order number: letters and digits only, upper case (`DH-20261105-0001` becomes `DH202611050001`). */
export const transferContentOf = (orderNo: string): string => orderNo.replaceAll(/[^A-Za-z0-9]/g, "").toUpperCase()

/** The items of an order in a few words: `2 x tea, 1 x cake`. */
export const itemsTextOf = (lines: ReadonlyArray<OrderLine>): string =>
    lines.map((line) => `${String(line.qty)} x ${line.name}`).join(", ")
