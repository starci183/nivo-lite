import { messageOf } from "../messages/catalog"
import type { OrderSummaryPayload, PaymentReceivedPayload } from "../modules/sales/agent-message-kinds"
import { ORDER_HREF } from "../nodes/sales/order-notice.href"
import { summaryLinesOf } from "../nodes/sales/order-notice.lines"
import type { CatalogueImageRow } from "../nodes/sales/order-notice.lines"
import {
    amountTextOf,
    noticeLinesOf,
    orderSummaryOf,
    orderTitleOf,
    paymentSummaryOf,
} from "../nodes/sales/order-notice.policy"
import type { NoticeLocale } from "../nodes/sales/order-notice.policy"

/** An order as a card to the team reads it from the record. */
export interface CardOrder {
    /** The order number. */
    readonly orderNo: string
    /** The total in VND, or null while a price is missing. */
    readonly amountVnd: number | null
    /** The items as the order record keeps them. */
    readonly items: unknown
    /** The delivery address and notes of the order; empty when none. */
    readonly note: string
}

/** A card to the team as the chat stores it: the heading, the one line where no card is drawn, the content of its kind and the record it opens. */
export interface TeamCard<P> {
    /** The registered kind of the content. */
    readonly kind: string
    /** What the message is for. */
    readonly intent: "notify"
    /** The heading. */
    readonly title: string
    /** The one line the chat shows where no card is drawn. */
    readonly summary: string
    /** The content, in the shape its kind declares. */
    readonly payload: P
    /** The record the message is about, with where it opens. */
    readonly work: { readonly label: string; readonly href: string }
}

const workOf = (locale: NoticeLocale): { readonly label: string; readonly href: string } => ({
    label: messageOf(locale, "orderNoticeOrder"),
    href: ORDER_HREF,
})

/**
 * The card of an order for the team, built from the order record alone: its number, its lines with the catalogue photo and the prices the
 * record holds, the total, the customer and where to deliver. Nothing on it comes from the one who asked for the card.
 */
export const teamOrderCardOf = (
    order: CardOrder,
    customer: string,
    catalogue: ReadonlyArray<CatalogueImageRow>,
    locale: NoticeLocale,
): TeamCard<OrderSummaryPayload> => ({
    kind: "order.summary",
    intent: "notify",
    title: orderTitleOf(order.orderNo, locale),
    summary: orderSummaryOf(
        {
            orderNo: order.orderNo,
            lines: noticeLinesOf(order.items),
            amountVnd: order.amountVnd,
            customer,
            address: order.note,
        },
        locale,
    ),
    payload: {
        orderNo: order.orderNo,
        lines: summaryLinesOf(order.items, catalogue, locale),
        amountText: order.amountVnd === null ? "" : amountTextOf(order.amountVnd, locale),
        customer,
        address: order.note,
    },
    work: workOf(locale),
})

/**
 * The card of the money that paid an order, built from the order record and the amount of the bank credit that paid it: the amount
 * received, the order's lines, the customer.
 */
export const teamPaymentCardOf = (
    order: CardOrder,
    receivedVnd: number,
    customer: string,
    catalogue: ReadonlyArray<CatalogueImageRow>,
    locale: NoticeLocale,
): TeamCard<PaymentReceivedPayload> => ({
    kind: "payment.received",
    intent: "notify",
    title: amountTextOf(receivedVnd, locale),
    summary: paymentSummaryOf(order.orderNo, receivedVnd, locale),
    payload: {
        orderNo: order.orderNo,
        amountText: amountTextOf(receivedVnd, locale),
        lines: summaryLinesOf(order.items, catalogue, locale),
        customer,
    },
    work: workOf(locale),
})
