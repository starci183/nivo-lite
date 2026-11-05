import { moneyLine } from "./money"

/** An order that waits for the owner, with the name of its customer. */
export interface WaitingOrder {
    /** The order id. */
    readonly id: string
    /** The order number. */
    readonly orderNo: string
    /** What was ordered, as text. */
    readonly items: string
    /** The amount, VND, or null while unknown. */
    readonly amountVnd: number | null
    /** The customer's name, or null when the order has no customer. */
    readonly customer: string | null
}

/** One waiting order as a region draws it. */
export interface WaitingRow {
    /** The key the region draws the row under. */
    readonly id: string
    /** The headline: the order number and the customer. */
    readonly title: string
    /** The line under it: the items and the amount. */
    readonly description: string
    /** Where choosing the row goes. */
    readonly href: string
}

/** The orders waiting for the owner, as the region of waiting items reads them. */
export interface WaitingView {
    /** The count badge; null when nothing waits. */
    readonly count: string | null
    /** The orders the region lists, already cut to the number it shows. */
    readonly rows: ReadonlyArray<WaitingRow>
    /** The words of a link beside the rows; empty, the rows are the links. */
    readonly linkLabel: string
    /** Where that link goes; empty. */
    readonly linkHref: string
    /** "+N" when more wait than are listed, else null. */
    readonly more: string | null
}

/** The line under a waiting order: its items, then its amount when known. */
const descriptionOf = (order: WaitingOrder): string =>
    [order.items, moneyLine(order.amountVnd)].filter((part) => part !== "").join(" · ")

/** The headline of a waiting order: its number, then its customer when known. */
const titleOf = (order: WaitingOrder): string =>
    order.customer === null ? order.orderNo : `${order.orderNo} · ${order.customer}`

/**
 * The orders that wait for the owner as the waiting region reads them: the first `shown` rows, a count of all that wait and the
 * number beyond those shown.
 */
export const waitingViewOf = (
    orders: ReadonlyArray<WaitingOrder>,
    total: number,
    shown: number,
    hrefOf: (orderId: string) => string,
): WaitingView => {
    const rows = orders.slice(0, shown).map((order): WaitingRow => ({
        id: order.id,
        title: titleOf(order),
        description: descriptionOf(order),
        href: hrefOf(order.id),
    }))
    return {
        count: total === 0 ? null : String(total),
        rows,
        linkLabel: "",
        linkHref: "",
        more: total > rows.length ? `+${String(total - rows.length)}` : null,
    }
}
